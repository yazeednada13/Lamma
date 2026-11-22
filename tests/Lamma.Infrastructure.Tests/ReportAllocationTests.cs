using Lamma.Infrastructure.Persistence.Repositories;

namespace Lamma.Infrastructure.Tests;

public sealed class ReportAllocationTests
{
    [Theory]
    [InlineData("1", "30,10", "0.75,0.25")]
    [InlineData("1", "10,10,10", "0.33,0.33,0.34")] // the last share takes the remainder
    [InlineData("14.62", "10,5", "9.75,4.87")]
    [InlineData("0", "10,5", "0,0")]
    [InlineData("3", "0,0", "0,3")]
    public void Shares_are_proportional_and_add_up_exactly(string total, string weights, string expected)
    {
        static decimal[] Parse(string s) => s.Split(',').Select(x => decimal.Parse(x, System.Globalization.CultureInfo.InvariantCulture)).ToArray();
        var shares = ReportQueries.Allocate(Parse(total)[0], Parse(weights));
        Assert.Equal(Parse(expected), shares);
        Assert.Equal(Parse(total)[0], shares.Sum());
    }
}
