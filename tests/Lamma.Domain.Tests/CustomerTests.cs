using Lamma.Domain.Businesses;
using Lamma.Domain.Common;
using Lamma.Domain.Customers;

namespace Lamma.Domain.Tests;

public sealed class PhoneNumberTests
{
    [Theory]
    [InlineData("0791234567", "+962791234567")]
    [InlineData("079 123 4567", "+962791234567")]
    [InlineData("791234567", "+962791234567")]
    [InlineData("962781234567", "+962781234567")]
    [InlineData("+962 77 123 4567", "+962771234567")]
    [InlineData("00962791234567", "+962791234567")]
    [InlineData("٠٧٩١٢٣٤٥٦٧", "+962791234567")]
    [InlineData("+966501234567", "+966501234567")]
    [InlineData("0044 20 7946 0958", "+442079460958")]
    public void Valid_numbers_are_normalized_to_E164(string input, string expected)
        => Assert.Equal(expected, PhoneNumber.Normalize(input));

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Empty_input_means_no_phone(string? input)
        => Assert.Null(PhoneNumber.Normalize(input));

    [Theory]
    [InlineData("0761234567")] // not a Jordanian mobile prefix
    [InlineData("07912345")] // too short
    [InlineData("+9627912345678")] // too long for Jordan
    [InlineData("12345")]
    [InlineData("+123")]
    public void Invalid_numbers_are_rejected(string input)
        => Assert.Equal("customer.invalid_phone", Assert.Throws<DomainException>(() => PhoneNumber.Normalize(input)).Code);

    [Fact]
    public void Customer_trims_and_bounds_its_fields()
    {
        var customer = Customer.Create(Guid.NewGuid(), "  رنا ", "0791234567", SalesChannel.Instagram, JordanGovernorate.Amman, " خلدا ", "  ");
        Assert.Equal(("رنا", "+962791234567", "خلدا"), (customer.Name, customer.PhoneE164, customer.Area));
        Assert.Null(customer.Notes);
        Assert.Equal("customer.name_too_long", Assert.Throws<DomainException>(() => customer.Update(new string('x', 101), null, SalesChannel.Other, null, null, null)).Code);
    }
}

public sealed class CustomerSegmentPolicyTests
{
    private static readonly DateOnly Today = new(2026, 11, 20);

    private static IReadOnlyList<CustomerSegment> For(int orders, decimal spent = 0, decimal due = 0, int? daysSinceLast = null, decimal? cutoff = null)
        => CustomerSegmentPolicy.For(new CustomerStats(orders, spent, due, daysSinceLast is { } d ? Today.AddDays(-d) : null), Today, cutoff);

    [Fact]
    public void Two_orders_are_new_and_three_are_not()
    {
        Assert.Contains(CustomerSegment.New, For(2, daysSinceLast: 1));
        Assert.DoesNotContain(CustomerSegment.New, For(3, daysSinceLast: 1));
    }

    [Fact]
    public void Dormant_after_more_than_14_days_and_never_for_customers_without_orders()
    {
        Assert.DoesNotContain(CustomerSegment.Dormant, For(5, daysSinceLast: 14));
        Assert.Contains(CustomerSegment.Dormant, For(5, daysSinceLast: 15));
        Assert.Equal([CustomerSegment.New], For(0));
    }

    [Fact]
    public void Owes_when_balance_is_positive_and_segments_combine()
        => Assert.Equal([CustomerSegment.Vip, CustomerSegment.Owes, CustomerSegment.New, CustomerSegment.Dormant], For(1, spent: 100, due: 5, daysSinceLast: 30, cutoff: 50));

    [Fact]
    public void Vip_cutoff_is_the_spend_at_the_top_third_rank()
    {
        // 6 customers → rank ⌈6 × 0.34⌉ = 3 → the third highest spend.
        Assert.Equal(200m, CustomerSegmentPolicy.VipCutoff([500, 300, 200, 200, 50, 0]));
        Assert.Null(CustomerSegmentPolicy.VipCutoff([0, 0, 0]));
        Assert.Null(CustomerSegmentPolicy.VipCutoff([]));
        Assert.Equal(10m, CustomerSegmentPolicy.VipCutoff([10]));
    }

    [Fact]
    public void Ties_at_the_cutoff_are_vip_and_zero_spend_never_is()
    {
        Assert.Contains(CustomerSegment.Vip, For(3, spent: 200, cutoff: 200));
        Assert.DoesNotContain(CustomerSegment.Vip, For(3, spent: 199.999m, cutoff: 200));
        Assert.DoesNotContain(CustomerSegment.Vip, For(0, spent: 0, cutoff: 0));
    }
}
