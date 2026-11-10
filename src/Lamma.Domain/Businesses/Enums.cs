namespace Lamma.Domain.Businesses;

/// <summary>Approved sales channels (D-022).</summary>
public enum SalesChannel
{
    Instagram,
    Whatsapp,
    Facebook,
    Other,
}

/// <summary>Approved payment methods (D-023). Codes: cash, cliq, bank_transfer, cod, zain_cash, orange_money.</summary>
public enum PaymentMethod
{
    Cash,
    Cliq,
    BankTransfer,
    Cod,
    ZainCash,
    OrangeMoney,
}

/// <summary>Display only in V1. Trial-expiry enforcement is NOT approved (D-011).</summary>
public enum SubscriptionPlan
{
    Trial,
    Monthly,
    Yearly,
}

/// <summary>V1 has exactly one role: the owner (D-004). Kept as a type for future multi-user support (D-005).</summary>
public enum MembershipRole
{
    Owner,
}
