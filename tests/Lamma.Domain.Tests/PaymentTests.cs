using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Orders;
using Lamma.Domain.Payments;

namespace Lamma.Domain.Tests;

public sealed class PaymentRuleTests
{
    private static readonly DateTime Now = new(2026, 11, 21, 9, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Today = new(2026, 11, 21);
    private static readonly Guid Business = Guid.NewGuid();

    private static Payment OrderPayment(decimal remaining, decimal amount, PaymentMethod method = PaymentMethod.Cash, DateOnly? paidOn = null, DateOnly? createdOn = null, string? note = null)
        => Payment.ForOrder(Business, Guid.NewGuid(), Guid.NewGuid(), remaining, amount, method, paidOn ?? Today, Today, createdOn ?? Today.AddDays(-3), note, Guid.NewGuid(), Now);

    private static string CodeOf(Action act) => Assert.ThrowsAny<DomainException>(act).Code;

    public static TheoryData<OrderStatus, PaymentMethod?, decimal, decimal, PaymentStatus?> StatusCases() => new()
    {
        { OrderStatus.Cancelled, PaymentMethod.Cash, 10m, 0m, null },
        { OrderStatus.New, null, 10m, 0m, PaymentStatus.Unpaid },
        { OrderStatus.New, PaymentMethod.Cash, 10m, 4m, PaymentStatus.Partial },
        { OrderStatus.Confirmed, PaymentMethod.Cod, 10m, 0m, PaymentStatus.Unpaid },
        { OrderStatus.Courier, PaymentMethod.Cod, 10m, 0m, PaymentStatus.Courier },
        { OrderStatus.Delivered, PaymentMethod.Cod, 10m, 3m, PaymentStatus.Courier },
        { OrderStatus.Delivered, PaymentMethod.Cod, 10m, 10m, PaymentStatus.Paid },
        { OrderStatus.Delivered, PaymentMethod.Cliq, 10m, 9.999m, PaymentStatus.Partial },
        { OrderStatus.Delivered, PaymentMethod.Cliq, 10m, 10m, PaymentStatus.Paid },
        { OrderStatus.Preparing, PaymentMethod.Cash, 10m, 10m, PaymentStatus.Paid },
    };

    [Theory]
    [MemberData(nameof(StatusCases))]
    public void Payment_status_is_derived_first_match_wins(OrderStatus status, PaymentMethod? method, decimal total, decimal paid, PaymentStatus? expected)
        => Assert.Equal(expected, PaymentStatusPolicy.For(status, method, total, paid));

    [Theory]
    [InlineData(OrderStatus.Delivered, PaymentMethod.Cash, 5, true)]
    [InlineData(OrderStatus.Delivered, null, 5, true)]
    [InlineData(OrderStatus.Delivered, PaymentMethod.Cod, 5, false)] // courier-held, not a customer receivable
    [InlineData(OrderStatus.Delivered, PaymentMethod.Cash, 0, false)]
    [InlineData(OrderStatus.Courier, PaymentMethod.Cash, 5, false)]
    [InlineData(OrderStatus.Confirmed, PaymentMethod.Cash, 5, false)]
    public void Receivable_means_delivered_due_and_not_courier_held(OrderStatus status, PaymentMethod? method, int remaining, bool expected)
        => Assert.Equal(expected, PaymentStatusPolicy.IsReceivable(status, method, remaining));

    [Theory]
    [InlineData(0, AgingBucket.Fresh)]
    [InlineData(7, AgingBucket.Fresh)]
    [InlineData(8, AgingBucket.Late)]
    [InlineData(30, AgingBucket.Late)]
    [InlineData(31, AgingBucket.Overdue)]
    public void Aging_buckets_follow_D038(int days, AgingBucket expected)
        => Assert.Equal(expected, PaymentStatusPolicy.BucketOf(days));

    [Fact]
    public void Age_counts_calendar_days_and_is_never_negative()
    {
        Assert.Equal(31, PaymentStatusPolicy.AgeDays(new DateOnly(2026, 10, 21), Today));
        Assert.Equal(0, PaymentStatusPolicy.AgeDays(Today.AddDays(1), Today));
    }

    [Fact]
    public void Fifo_allocation_is_exact_to_the_fils_and_skips_settled_orders()
    {
        var (a, b, c, d) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var lines = PaymentAllocator.Allocate(25.75m, [new(a, 10.5m), new(b, 0m), new(c, 20.255m), new(d, 5m)]);

        Assert.Equal([new AllocationLine(a, 10.5m), new AllocationLine(c, 15.25m)], lines);
        Assert.Equal(25.75m, lines.Sum(l => l.Amount));
        Assert.Equal(3, PaymentAllocator.Allocate(35.755m, [new(a, 10.5m), new(c, 20.255m), new(d, 5m)]).Count);
    }

    [Fact]
    public void Fifo_allocation_rejects_more_than_the_balance_and_non_positive_amounts()
    {
        var conflict = Assert.Throws<DomainConflictException>(() => PaymentAllocator.Allocate(10.01m, [new(Guid.NewGuid(), 10m)]));
        Assert.Equal("payment.exceeds_balance", conflict.Code);
        Assert.Equal("payment.exceeds_balance", CodeOf(() => PaymentAllocator.Allocate(1m, [])));
        Assert.Equal("payment.invalid_amount", CodeOf(() => PaymentAllocator.Allocate(0m, [new(Guid.NewGuid(), 10m)])));
    }

    [Fact]
    public void Order_payment_needs_a_valid_amount_method_and_date()
    {
        var payment = OrderPayment(remaining: 30m, amount: 30m, note: "  عربون  ");
        Assert.Equal((30m, "عربون"), (Assert.Single(payment.Allocations).Amount, payment.Note));

        Assert.Equal("payment.exceeds_remaining", Assert.Throws<DomainConflictException>(() => OrderPayment(30m, 30.01m)).Code);
        Assert.Equal("payment.exceeds_remaining", Assert.Throws<DomainConflictException>(() => OrderPayment(0m, 1m)).Code);
        Assert.Equal("payment.invalid_amount", CodeOf(() => OrderPayment(30m, 0m)));
        Assert.Equal("payment.invalid_amount", CodeOf(() => OrderPayment(30m, 1.0005m)));
        Assert.Equal("payment.method_not_allowed", CodeOf(() => OrderPayment(30m, 5m, PaymentMethod.Cod)));
        Assert.Equal("payment.invalid_date", CodeOf(() => OrderPayment(30m, 5m, paidOn: Today.AddDays(1))));
        Assert.Equal("payment.invalid_date", CodeOf(() => OrderPayment(30m, 5m, paidOn: Today.AddDays(-4))));
        Assert.Equal("payment.text_too_long", CodeOf(() => OrderPayment(30m, 5m, note: new string('x', Payment.NoteMaxLength + 1))));
        Assert.Equal(Today.AddDays(-3), OrderPayment(30m, 5m, paidOn: Today.AddDays(-3)).PaidOn); // back-dating allowed (D-136)
    }

    [Fact]
    public void Reversal_voids_the_payment_and_every_allocation_once()
    {
        var payment = Payment.ForCustomer(Business, Guid.NewGuid(), [new(Guid.NewGuid(), 4m), new(Guid.NewGuid(), 6m)], 7m, PaymentMethod.Cliq, Today, Today, null, Guid.NewGuid(), Now);
        Assert.Null(payment.OrderId);
        Assert.Equal([4m, 3m], payment.Allocations.Select(a => a.Amount));

        payment.Reverse(" دخلت غلط ", Guid.NewGuid(), Now);

        Assert.True(payment.IsReversed);
        Assert.Equal("دخلت غلط", payment.ReversalReason);
        Assert.All(payment.Allocations, a => Assert.True(a.IsReversed));
        Assert.Equal("payment.already_reversed", Assert.Throws<DomainConflictException>(() => payment.Reverse(null, Guid.NewGuid(), Now)).Code);
    }
}
