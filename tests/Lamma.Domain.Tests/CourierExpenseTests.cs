using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Courier;
using Lamma.Domain.Expenses;
using Lamma.Domain.Payments;

namespace Lamma.Domain.Tests;

public sealed class CourierExpenseRuleTests
{
    private static readonly DateTime Now = new(2026, 11, 21, 9, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly Today = new(2026, 11, 21);
    private static readonly Guid Business = Guid.NewGuid();
    private static readonly Guid Delivery = Guid.NewGuid();

    private static HeldOrder Held(decimal remaining, int number = 1001, DateOnly? deliveredOn = null)
        => new(Guid.NewGuid(), Guid.NewGuid(), number, remaining, deliveredOn ?? Today.AddDays(-2));

    private static (CourierSettlement Settlement, SettlementWrites Writes) Settle(IReadOnlyList<HeldOrder> orders, decimal received, DateOnly? on = null)
        => CourierSettlement.Create(Business, orders, received, on ?? Today, Today, null, Delivery, Guid.NewGuid(), Now);

    private static string CodeOf(Action act) => Assert.ThrowsAny<DomainException>(act).Code;

    [Fact]
    public void Settlement_pays_every_order_in_full_and_books_the_difference_once()
    {
        var a = Held(12.5m);
        var b = Held(20m, 1002);
        var (settlement, writes) = Settle([a, b], received: 30m);

        Assert.Equal((32.5m, 30m, 2.5m), (settlement.ExpectedAmount, settlement.ReceivedAmount, settlement.Difference));
        Assert.Equal([12.5m, 20m], writes.Payments.Select(p => p.Amount));
        Assert.All(writes.Payments, p => Assert.Equal((PaymentMethod.Cod, settlement.Id), (p.Method, p.SettlementId!.Value)));
        var expense = Assert.IsType<Expense>(writes.DifferenceExpense);
        Assert.Equal((2.5m, Delivery, ExpenseSource.CourierSettlement, settlement.Id), (expense.Amount, expense.CategoryId, expense.Source, expense.SettlementId!.Value));
    }

    [Fact]
    public void Settlement_without_a_difference_books_no_expense_and_zero_received_books_all()
    {
        Assert.Null(Settle([Held(10m)], received: 10m).Writes.DifferenceExpense);
        Assert.Equal(10m, Settle([Held(10m)], received: 0m).Writes.DifferenceExpense!.Amount);
    }

    [Fact]
    public void Settlement_rejects_bad_input()
    {
        Assert.Equal("settlement.received_too_high", Assert.Throws<DomainConflictException>(() => Settle([Held(10m)], 10.001m)).Code);
        Assert.Equal("settlement.order_not_held", Assert.Throws<DomainConflictException>(() => Settle([Held(0m)], 0m)).Code);
        Assert.Equal("settlement.orders_required", CodeOf(() => Settle([], 0m)));
        Assert.Equal("settlement.invalid_amount", CodeOf(() => Settle([Held(10m)], -1m)));
        Assert.Equal("settlement.invalid_date", CodeOf(() => Settle([Held(10m)], 10m, Today.AddDays(1))));
        Assert.Equal("settlement.invalid_date", CodeOf(() => Settle([Held(10m, deliveredOn: Today)], 10m, Today.AddDays(-1))));
        var same = Held(10m);
        Assert.Equal("settlement.duplicate_order", CodeOf(() => Settle([same, same], 0m)));
    }

    [Fact]
    public void Reversal_voids_payments_expense_and_lines_once_and_settlement_parts_cannot_be_removed_alone()
    {
        var (settlement, writes) = Settle([Held(10m), Held(5m, 1002)], received: 12m);
        Assert.Equal("payment.from_settlement", Assert.Throws<DomainConflictException>(() => writes.Payments[0].Reverse(null, Guid.NewGuid(), Now)).Code);
        Assert.Equal("expense.from_settlement", Assert.Throws<DomainConflictException>(() => writes.DifferenceExpense!.Void(null, Now)).Code);

        settlement.Reverse(writes.Payments, writes.DifferenceExpense, "غلط بالمبلغ", Now);

        Assert.True(settlement.IsReversed);
        Assert.All(writes.Payments, p => Assert.True(p.IsReversed && p.Allocations.All(a => a.IsReversed)));
        Assert.True(writes.DifferenceExpense!.IsVoided);
        Assert.All(settlement.Orders, l => Assert.True(l.IsReversed));
        Assert.Equal("settlement.already_reversed", Assert.Throws<DomainConflictException>(() => settlement.Reverse(writes.Payments, writes.DifferenceExpense, null, Now)).Code);
    }

    [Fact]
    public void Delivery_category_is_fixed_and_others_can_change()
    {
        var category = ExpenseCategory.Custom(Business, "  إعلانات   تيك توك ");
        Assert.Equal("إعلانات تيك توك", category.Name);
        category.Rename("إعلانات");
        category.Archive();
        Assert.True(category.IsArchived);
        Assert.Equal("expense_category.name_too_long", CodeOf(() => category.Rename(new string('x', ExpenseCategory.NameMaxLength + 1))));
        Assert.Equal("expense_category.name_required", CodeOf(() => ExpenseCategory.Custom(Business, " ")));
        Assert.DoesNotContain(ExpenseCategory.Defaults, d => d.Name == "مشتريات"); // D-107
        Assert.Single(ExpenseCategory.Defaults, d => d.Code == ExpenseCategoryCode.Delivery);
    }

    [Fact]
    public void Manual_expense_rules()
    {
        var category = ExpenseCategory.Custom(Business, "تغليف");
        var expense = Expense.Manual(Business, category, 7.5m, Today.AddDays(-3), Today, " علب ", Guid.NewGuid(), Now);
        Assert.Equal((7.5m, "علب", ExpenseSource.Manual), (expense.Amount, expense.Note, expense.Source));

        Assert.Equal("expense.invalid_date", CodeOf(() => Expense.Manual(Business, category, 1m, Today.AddDays(1), Today, null, Guid.NewGuid(), Now)));
        Assert.Equal("expense.invalid_amount", CodeOf(() => Expense.Manual(Business, category, 0m, Today, Today, null, Guid.NewGuid(), Now)));
        expense.Void(null, Now);
        Assert.Equal("expense.already_voided", Assert.Throws<DomainConflictException>(() => expense.Void(null, Now)).Code);
        category.Archive();
        Assert.Equal("expense_category.archived", Assert.Throws<DomainConflictException>(() => Expense.Manual(Business, category, 1m, Today, Today, null, Guid.NewGuid(), Now)).Code);
    }
}
