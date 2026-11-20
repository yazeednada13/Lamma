using FluentValidation;
using Lamma.Application.Catalog;
using Lamma.Application.Common.Validation;
using Lamma.Domain.Catalog;

namespace Lamma.Application.Inventory;

public sealed class ReceiveLineRequestValidator : AbstractValidator<ReceiveLineRequest>
{
    public ReceiveLineRequestValidator()
    {
        RuleFor(x => x.VariantId).NotEmpty().WithMessage("اختار المنتج والنسخة.");
        RuleFor(x => x.Quantity).InclusiveBetween(1, ProductVariant.MaxQuantity).WithMessage($"الكمية لازم تكون بين 1 و {ProductVariant.MaxQuantity}.");
        RuleFor(x => x.UnitCost).Must(v => MoneyInput.IsValid(v, allowZero: true)).WithMessage(MoneyInput.Message(true, "تكلفة القطعة"));
    }
}

public sealed class ReceiveStockRequestValidator : AbstractValidator<ReceiveStockRequest>
{
    public ReceiveStockRequestValidator()
    {
        RuleFor(x => x.Supplier).MaximumLength(StockReceipt.SupplierMaxLength).WithMessage($"اسم المورّد لازم يكون {StockReceipt.SupplierMaxLength} حرف أو أقل.");
        RuleFor(x => x.Note).MaximumLength(StockReceipt.NoteMaxLength).WithMessage($"الملاحظة لازم تكون {StockReceipt.NoteMaxLength} حرف أو أقل.");
        RuleFor(x => x.Lines)
            .Must(l => l is { Count: > 0 and <= StockReceipt.MaxLines }).WithMessage($"أضف من 1 لـ {StockReceipt.MaxLines} صنف.")
            .Must(l => l is null || l.Select(x => x.VariantId).Distinct().Count() == l.Count).WithMessage("في نسخة مكررة بالاستلام.");
        RuleForEach(x => x.Lines).SetValidator(new ReceiveLineRequestValidator());
    }
}

public sealed class AdjustStockRequestValidator : AbstractValidator<AdjustStockRequest>
{
    public AdjustStockRequestValidator()
    {
        RuleFor(x => x.VariantId).NotEmpty().WithMessage("اختار المنتج والنسخة.");
        RuleFor(x => x.Delta).Must(d => d != 0 && Math.Abs(d) <= ProductVariant.MaxQuantity).WithMessage($"الكمية لازم تكون بين 1 و {ProductVariant.MaxQuantity}.");
        RuleFor(x => x.Reason).IsCodeOf<AdjustStockRequest, AdjustmentReason>("اختار السبب من القائمة.");
        RuleFor(x => x.Note).MaximumLength(StockMovement.ReasonMaxLength).WithMessage($"الملاحظة لازم تكون {StockMovement.ReasonMaxLength} حرف أو أقل.");
    }
}

public sealed class InventoryLevelsQueryValidator : AbstractValidator<InventoryLevelsQuery>
{
    public InventoryLevelsQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("رقم الصفحة لازم يكون 1 أو أكثر.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, ProductListQuery.MaxPageSize).WithMessage($"حجم الصفحة لازم يكون بين 1 و {ProductListQuery.MaxPageSize}.");
        RuleFor(x => x.Status).Must(s => s is null or "low" or "out").WithMessage("حالة المخزون غير معروفة.");
        RuleFor(x => x.Search).MaximumLength(100).WithMessage("نص البحث طويل كثير.");
    }
}

public sealed class MovementLogQueryValidator : AbstractValidator<MovementLogQuery>
{
    public MovementLogQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("رقم الصفحة لازم يكون 1 أو أكثر.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, ProductListQuery.MaxPageSize).WithMessage($"حجم الصفحة لازم يكون بين 1 و {ProductListQuery.MaxPageSize}.");
        RuleFor(x => x.Direction).Must(s => s is null or "in" or "out").WithMessage("الاتجاه غير معروف.");
        RuleFor(x => x.Origin).Must(s => s is null or "auto" or "manual").WithMessage("المصدر غير معروف.");
    }
}
