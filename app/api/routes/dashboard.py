from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.database import Discrepancy, Invoice, Reconciliation
from app.models.schemas import DashboardStats

router = APIRouter()


@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    # Invoice counts
    total_inv = await db.execute(select(func.count(Invoice.id)))
    total_invoices = total_inv.scalar() or 0

    # By processing status
    proc_stmt = select(
        Invoice.processing_status, func.count(Invoice.id)
    ).group_by(Invoice.processing_status)
    proc_result = await db.execute(proc_stmt)
    by_processing = {row[0]: row[1] for row in proc_result.all()}

    # By business status
    biz_stmt = select(
        Invoice.business_status, func.count(Invoice.id)
    ).group_by(Invoice.business_status)
    biz_result = await db.execute(biz_stmt)
    by_business = {row[0]: row[1] for row in biz_result.all()}

    # Reconciliation counts
    total_rec = await db.execute(select(func.count(Reconciliation.id)))
    total_reconciliations = total_rec.scalar() or 0

    match_stmt = select(
        Reconciliation.match_type, func.count(Reconciliation.id)
    ).group_by(Reconciliation.match_type)
    match_result = await db.execute(match_stmt)
    match_rate = {row[0]: row[1] for row in match_result.all()}

    # Avg processing time
    avg_stmt = select(func.avg(Reconciliation.processing_time_ms))
    avg_result = await db.execute(avg_stmt)
    avg_time = avg_result.scalar()

    # Top discrepancy types
    disc_stmt = (
        select(Discrepancy.type, func.count(Discrepancy.id))
        .group_by(Discrepancy.type)
        .order_by(func.count(Discrepancy.id).desc())
        .limit(10)
    )
    disc_result = await db.execute(disc_stmt)
    top_discrepancies = {row[0]: row[1] for row in disc_result.all()}

    return DashboardStats(
        total_invoices=total_invoices,
        by_processing_status=by_processing,
        by_business_status=by_business,
        total_reconciliations=total_reconciliations,
        match_rate=match_rate,
        avg_processing_time_ms=avg_time,
        top_discrepancy_types=top_discrepancies,
    )
