using Lamma.Application.Accounts;
using Lamma.Application.Businesses;
using Lamma.Application.Common;
using Lamma.Application.Identity;
using Lamma.Domain.Businesses;

namespace Lamma.Application.Tests;

// Hand-written fakes (no mocking library, per the approved package list).

internal sealed class FakeClock : IClock
{
    public DateTime UtcNow { get; set; } = new(2026, 11, 10, 9, 0, 0, DateTimeKind.Utc);
}

internal sealed class FakeCurrentUser(Guid? userId) : ICurrentUser
{
    public bool IsAuthenticated => UserId.HasValue;

    public Guid? UserId { get; } = userId;

    public Guid RequiredUserId => UserId ?? throw new UnauthorizedException("auth.unauthenticated", "x");
}

internal sealed class FakeEmailSender(bool configured = true) : IEmailSender
{
    public bool IsConfigured { get; } = configured;

    public List<(string Email, string Link)> Sent { get; } = [];

    public List<Lamma.Application.Common.Email.EmailMessage> Messages { get; } = [];

    public Task SendPasswordResetAsync(string toEmail, string fullName, string resetLink, CancellationToken cancellationToken)
    {
        Sent.Add((toEmail, resetLink));
        return Task.CompletedTask;
    }

    public Task SendAsync(Lamma.Application.Common.Email.EmailMessage message, CancellationToken cancellationToken)
    {
        Messages.Add(message);
        Sent.Add((message.To, message.Link ?? string.Empty));
        return Task.CompletedTask;
    }
}

internal sealed class FakeLinks : IAppLinks
{
    public string PasswordReset(string email, string token) => $"https://app/reset?email={email}&token={token}";

    public string Register(string token) => $"https://app/register?token={token}";

    public string Login() => "https://app/login";

    public string Home() => "https://app/";

    public string Subscription() => "https://app/subscription";

    public string AdminPayments() => "https://app/admin/payments";
}

internal sealed class FakeIdentityService : IIdentityService
{
    public IdentityResultInfo CreateResult { get; set; } = IdentityResultInfo.Success(Guid.NewGuid());

    public PasswordSignInOutcome SignInOutcome { get; set; } = new(PasswordSignInStatus.InvalidCredentials, null);

    public Dictionary<string, PasswordResetToken> ResetTokens { get; } = [];

    public int LookupCount { get; private set; }

    public List<Guid> SignedIn { get; } = [];

    public HashSet<string> ExistingEmails { get; } = new(StringComparer.OrdinalIgnoreCase);

    public Task<IdentityResultInfo> CreateUserAsync(string fullName, string email, string password, CancellationToken cancellationToken, string? phoneE164 = null)
        => Task.FromResult(CreateResult);

    public Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken) => Task.FromResult(ExistingEmails.Contains(email));

    public Task<PasswordSignInOutcome> PasswordSignInAsync(string email, string password, bool persistent, CancellationToken cancellationToken)
        => Task.FromResult(SignInOutcome);

    public Task SignInAsync(Guid userId, bool persistent, CancellationToken cancellationToken)
    {
        SignedIn.Add(userId);
        return Task.CompletedTask;
    }

    public Task SignOutAsync() => Task.CompletedTask;

    public Task<PasswordResetToken?> GeneratePasswordResetTokenAsync(string email, CancellationToken cancellationToken)
    {
        LookupCount++;
        return Task.FromResult(ResetTokens.GetValueOrDefault(email));
    }

    public Task<IdentityResultInfo> ResetPasswordAsync(string email, string token, string newPassword, CancellationToken cancellationToken)
        => Task.FromResult(IdentityResultInfo.Failure(IdentityErrorCodes.InvalidToken));

    public Task<IdentityResultInfo> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken cancellationToken)
        => Task.FromResult(IdentityResultInfo.Failure(IdentityErrorCodes.PasswordMismatch));

    public Task<UserProfile?> GetProfileAsync(Guid userId, CancellationToken cancellationToken)
        => Task.FromResult<UserProfile?>(new UserProfile(userId, "ريم", "reem@example.com"));

    public Task<IdentityResultInfo> UpdateFullNameAsync(Guid userId, string fullName, CancellationToken cancellationToken)
        => Task.FromResult(IdentityResultInfo.Success(userId));
}

internal sealed class FakeAccountService : IAccountService
{
    public Task<AccountDto> GetCurrentAsync(CancellationToken cancellationToken) => throw new NotSupportedException();

    public Task<AccountDto> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken)
        => Task.FromResult(new AccountDto(userId, "ريم", "reem@example.com", false, null));

    public Task<AccountDto> UpdateAsync(UpdateAccountRequest request, CancellationToken cancellationToken) => throw new NotSupportedException();

    public Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken cancellationToken) => throw new NotSupportedException();
}

internal sealed class FakeBusinessRepository : IBusinessRepository
{
    public List<Business> Added { get; } = [];

    public Task<Business?> GetForUpdateAsync(Guid businessId, CancellationToken cancellationToken)
        => Task.FromResult(Added.FirstOrDefault(b => b.Id == businessId));

    public void Add(Business business) => Added.Add(business);
}

internal sealed class FakeMembershipRepository : IMembershipRepository
{
    public bool Exists { get; set; }

    public List<BusinessMembership> Added { get; } = [];

    public Task<bool> ExistsForUserAsync(Guid userId, CancellationToken cancellationToken) => Task.FromResult(Exists);

    public void Add(BusinessMembership membership) => Added.Add(membership);
}

internal sealed class FakeUnitOfWork : IUnitOfWork
{
    public int SaveCount { get; private set; }

    public Exception? ThrowOnSave { get; set; }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
    {
        SaveCount++;
        return ThrowOnSave is null ? Task.FromResult(1) : Task.FromException<int>(ThrowOnSave);
    }

    public Task ExecuteInTransactionAsync(Func<CancellationToken, Task> work, CancellationToken cancellationToken) => work(cancellationToken);
}

internal sealed class FakePlatformAdmins : Lamma.Application.Subscriptions.IPlatformAdmins
{
    public HashSet<Guid> AdminIds { get; } = [];

    public IReadOnlyList<string> Emails { get; } = [];

    public Task<bool> IsAdminAsync(Guid userId, CancellationToken cancellationToken) => Task.FromResult(AdminIds.Contains(userId));

    public Task SyncAsync(string email, CancellationToken cancellationToken) => Task.CompletedTask;
}
