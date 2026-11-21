using Lamma.Api.Security;
using Lamma.Application.Catalog;
using Lamma.Application.Courier;
using Lamma.Application.Expenses;
using Lamma.Application.Finance;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Lamma.Api.Controllers;

/// <summary>Expense categories and expenses (Phase 7, D-142, D-143). Recording and voiding are idempotent (D-112).</summary>
[ApiController]
[Route("api/v1")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class ExpensesController(IExpenseService expenses) : ControllerBase
{
    [HttpGet("expense-categories")]
    public async Task<ActionResult<IReadOnlyList<ExpenseCategoryDto>>> Categories([FromQuery] bool includeArchived, CancellationToken cancellationToken)
        => Ok(await expenses.CategoriesAsync(includeArchived, cancellationToken));

    [HttpPost("expense-categories")]
    public async Task<ActionResult<ExpenseCategoryDto>> CreateCategory(ExpenseCategoryRequest request, CancellationToken cancellationToken)
    {
        var category = await expenses.CreateCategoryAsync(request, cancellationToken);
        return Created($"/api/v1/expense-categories/{category.Id}", category);
    }

    [HttpPut("expense-categories/{id:guid}")]
    public async Task<ActionResult<ExpenseCategoryDto>> RenameCategory(Guid id, ExpenseCategoryRequest request, CancellationToken cancellationToken)
        => Ok(await expenses.RenameCategoryAsync(id, request, cancellationToken));

    [HttpPost("expense-categories/{id:guid}/archive")]
    public async Task<ActionResult<ExpenseCategoryDto>> ArchiveCategory(Guid id, CancellationToken cancellationToken)
        => Ok(await expenses.SetCategoryArchivedAsync(id, archived: true, cancellationToken));

    [HttpPost("expense-categories/{id:guid}/restore")]
    public async Task<ActionResult<ExpenseCategoryDto>> RestoreCategory(Guid id, CancellationToken cancellationToken)
        => Ok(await expenses.SetCategoryArchivedAsync(id, archived: false, cancellationToken));

    [HttpGet("expenses")]
    public async Task<ActionResult<PagedResult<ExpenseDto>>> List([FromQuery] ExpenseListQuery query, CancellationToken cancellationToken)
        => Ok(await expenses.ListAsync(query, cancellationToken));

    [HttpGet("expenses/summary")]
    public async Task<ActionResult<ExpenseSummaryDto>> Summary([FromQuery] ExpenseSummaryQuery query, CancellationToken cancellationToken)
        => Ok(await expenses.SummaryAsync(query, cancellationToken));

    [HttpPost("expenses")]
    public async Task<ActionResult<ExpenseDto>> Record(RecordExpenseRequest request, [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
    {
        var expense = await expenses.RecordAsync(IdempotencyKeys.Parse(idempotencyKey), request, cancellationToken);
        return Created($"/api/v1/expenses/{expense.Id}", expense);
    }

    [HttpPost("expenses/{id:guid}/void")]
    public async Task<ActionResult<ExpenseDto>> Void(Guid id, VoidExpenseRequest request, [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
        => Ok(await expenses.VoidAsync(id, IdempotencyKeys.Parse(idempotencyKey), request, cancellationToken));
}

/// <summary>Courier company and settlements (Phase 7, D-139–D-141). Settling and reversing are idempotent (D-112).</summary>
[ApiController]
[Route("api/v1/courier")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class CourierController(ICourierService courier) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CourierOverviewDto>> Overview(CancellationToken cancellationToken)
        => Ok(await courier.OverviewAsync(cancellationToken));

    [HttpPut("settings")]
    public async Task<ActionResult<CourierOverviewDto>> UpdateSettings(CourierSettingsRequest request, CancellationToken cancellationToken)
        => Ok(await courier.UpdateSettingsAsync(request, cancellationToken));

    [HttpGet("settlements")]
    public async Task<ActionResult<PagedResult<SettlementDto>>> Settlements([FromQuery] SettlementListQuery query, CancellationToken cancellationToken)
        => Ok(await courier.SettlementsAsync(query, cancellationToken));

    [HttpPost("settlements")]
    public async Task<ActionResult<SettlementDto>> Settle(CreateSettlementRequest request, [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
    {
        var settlement = await courier.SettleAsync(IdempotencyKeys.Parse(idempotencyKey), request, cancellationToken);
        return Created($"/api/v1/courier/settlements/{settlement.Id}", settlement);
    }

    [HttpPost("settlements/{id:guid}/reverse")]
    public async Task<ActionResult<SettlementDto>> Reverse(Guid id, ReverseSettlementRequest request, [FromHeader(Name = InventoryController.IdempotencyHeader)] string? idempotencyKey, CancellationToken cancellationToken)
        => Ok(await courier.ReverseAsync(id, IdempotencyKeys.Parse(idempotencyKey), request, cancellationToken));
}

/// <summary>Finance overview (Phase 7, D-144).</summary>
[ApiController]
[Route("api/v1/finance")]
[Authorize(Policy = Policies.RequireBusiness)]
public sealed class FinanceController(IFinanceService finance) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<ActionResult<FinanceOverviewDto>> Overview([FromQuery] FinanceOverviewQuery query, CancellationToken cancellationToken)
        => Ok(await finance.OverviewAsync(query, cancellationToken));
}
