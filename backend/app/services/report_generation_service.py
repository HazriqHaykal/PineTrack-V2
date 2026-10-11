"""
PDF Report Generation Service
Generates professional reports with harvest, transport, and waste analytics
Uses ReportLab for PDF creation
"""

from io import BytesIO
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Harvest, Transport, Waste, User
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
    PageBreak, Image, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import logging

logger = logging.getLogger(__name__)


class ReportGenerationService:
    """Service for generating PDF reports"""
    
    # Color scheme for reports
    COLORS = {
        "primary": colors.HexColor("#16a34a"),      # Green
        "secondary": colors.HexColor("#3b82f6"),    # Blue
        "warning": colors.HexColor("#f97316"),      # Orange
        "danger": colors.HexColor("#dc2626"),       # Red
        "light": colors.HexColor("#f3f4f6"),        # Light gray
        "dark": colors.HexColor("#1f2937"),         # Dark gray
    }
    
    @staticmethod
    def _create_styles():
        """Create custom text styles for the report"""
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=ReportGenerationService.COLORS['primary'],
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=ReportGenerationService.COLORS['primary'],
            spaceAfter=12,
            spaceBefore=12,
            fontName='Helvetica-Bold'
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_LEFT,
            spaceAfter=6
        )
        
        return {
            'title': title_style,
            'heading': heading_style,
            'normal': normal_style,
            'body': styles['Normal']
        }
    
    @staticmethod
    def get_harvest_stats(db: Session, days: int = 30) -> Dict:
        """Get harvest statistics for the report period"""
        cutoff_date = (datetime.now() - timedelta(days=days)).date()
        
        harvests = db.query(Harvest).filter(Harvest.harvest_date >= cutoff_date).all()
        
        if not harvests:
            return {
                "total_harvests": 0,
                "total_quantity_kg": 0,
                "average_quantity": 0,
                "quality_distribution": {},
                "harvests_list": []
            }
        
        # Quality distribution
        quality_dist = {}
        total_kg = 0
        
        for h in harvests:
            grade = h.quality_grade or "ungraded"
            quality_dist[grade] = quality_dist.get(grade, 0) + 1
            total_kg += h.quantity_kg
        
        return {
            "total_harvests": len(harvests),
            "total_quantity_kg": round(total_kg, 2),
            "average_quantity": round(total_kg / len(harvests), 2),
            "quality_distribution": quality_dist,
            "harvests_list": harvests
        }
    
    @staticmethod
    def get_transport_stats(db: Session, days: int = 30) -> Dict:
        """Get transport statistics for the report period"""
        cutoff_date = (datetime.now() - timedelta(days=days)).date()
        
        transports = db.query(Transport).filter(Transport.scheduled_date >= cutoff_date).all()
        
        if not transports:
            return {
                "total_transports": 0,
                "delivered_count": 0,
                "in_transit_count": 0,
                "pending_count": 0,
                "delivery_rate": 0,
                "transports_list": []
            }
        
        status_count = {}
        for t in transports:
            status_count[t.status] = status_count.get(t.status, 0) + 1
        
        delivered = status_count.get('delivered', 0)
        delivery_rate = (delivered / len(transports) * 100) if transports else 0
        
        return {
            "total_transports": len(transports),
            "delivered_count": status_count.get('delivered', 0),
            "in_transit_count": status_count.get('in_transit', 0),
            "pending_count": status_count.get('pending', 0),
            "delivery_rate": round(delivery_rate, 1),
            "transports_list": transports
        }
    
    @staticmethod
    def get_waste_stats(db: Session, days: int = 30) -> Dict:
        """Get waste statistics for the report period"""
        cutoff_date = (datetime.now() - timedelta(days=days)).date()
        
        waste_records = db.query(Waste).filter(Waste.waste_date >= cutoff_date).all()
        
        if not waste_records:
            return {
                "total_records": 0,
                "total_waste_kg": 0,
                "waste_types": {},
                "waste_list": []
            }
        
        waste_by_type = {}
        total_kg = 0
        
        for w in waste_records:
            waste_by_type[w.waste_type] = waste_by_type.get(w.waste_type, 0) + w.quantity_kg
            total_kg += w.quantity_kg
        
        return {
            "total_records": len(waste_records),
            "total_waste_kg": round(total_kg, 2),
            "waste_types": waste_by_type,
            "waste_list": waste_records
        }
    
    # Which sections each report type contains
    REPORT_SECTIONS = {
        "harvest": ["harvest"],
        "transport": ["transport"],
        "waste": ["waste"],
        "analytics": ["harvest", "transport", "waste"],
        "summary": ["harvest", "transport", "waste"],
        "full": ["harvest", "transport", "waste"],
    }

    REPORT_TITLES = {
        "harvest": "Harvest Report",
        "transport": "Transport Report",
        "waste": "Waste Report",
        "analytics": "Analytics Report",
        "summary": "Operations Summary",
        "full": "Full Operations Report",
    }

    @classmethod
    def _metric_table(cls, rows, header_color) -> Table:
        """Two-column metric/value table used by every section"""
        table = Table([["Metric", "Value"]] + rows, colWidths=[2.5*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), header_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, cls.COLORS['light']])
        ]))
        return table

    @classmethod
    def _detail_table(cls, header, rows) -> Table:
        """Record listing table"""
        table = Table([header] + rows, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), cls.COLORS['dark']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, cls.COLORS['light']])
        ]))
        return table

    @classmethod
    def _harvest_section(cls, db: Session, days: int, styles, detailed: bool) -> list:
        stats = cls.get_harvest_stats(db, days)
        harvests = stats["harvests_list"]
        total_kg = stats["total_quantity_kg"]
        spoilage = round(sum(h.spoilage_kg or 0 for h in harvests), 2)
        rejected = round(sum(h.rejected_kg or 0 for h in harvests), 2)

        rows = [
            ["Total Harvests", str(stats['total_harvests'])],
            ["Total Quantity", f"{total_kg} kg"],
            ["Average per Harvest", f"{stats['average_quantity']} kg"],
            ["Spoilage", f"{spoilage} kg"],
            ["Rejected", f"{rejected} kg"],
            ["Marketable Yield", f"{round(total_kg - spoilage - rejected, 2)} kg"],
        ]
        for grade, count in sorted(stats['quality_distribution'].items(), key=lambda kv: str(kv[0])):
            rows.append([f"Grade {grade}", str(count)])

        elements = [
            Paragraph("Harvest Management", styles['heading']),
            cls._metric_table(rows, cls.COLORS['primary']),
            Spacer(1, 0.3*inch),
        ]
        if detailed and harvests:
            elements.append(cls._detail_table(
                ["Batch", "Field", "Date", "Qty (kg)", "Grade", "Status"],
                [[h.batch_number, h.field_name, str(h.harvest_date), f"{h.quantity_kg:g}",
                  h.quality_grade or "-", h.harvest_status] for h in harvests]
            ))
            elements.append(Spacer(1, 0.3*inch))
        return elements

    @classmethod
    def _transport_section(cls, db: Session, days: int, styles, detailed: bool) -> list:
        stats = cls.get_transport_stats(db, days)
        rows = [
            ["Total Transports", str(stats['total_transports'])],
            ["Delivered", str(stats['delivered_count'])],
            ["In Transit", str(stats['in_transit_count'])],
            ["Pending", str(stats['pending_count'])],
            ["Delivery Rate", f"{stats['delivery_rate']}%"],
        ]
        elements = [
            Paragraph("Transport &amp; Logistics", styles['heading']),
            cls._metric_table(rows, cls.COLORS['secondary']),
            Spacer(1, 0.3*inch),
        ]
        if detailed and stats["transports_list"]:
            elements.append(cls._detail_table(
                ["Destination", "Driver", "Vehicle", "Date", "Cargo (kg)", "Status"],
                [[t.destination, t.driver_name or "-", t.vehicle_number or "-", str(t.scheduled_date),
                  f"{t.cargo_weight_kg:g}" if t.cargo_weight_kg else "-", t.status]
                 for t in stats["transports_list"]]
            ))
            elements.append(Spacer(1, 0.3*inch))
        return elements

    @classmethod
    def _waste_section(cls, db: Session, days: int, styles, detailed: bool) -> list:
        stats = cls.get_waste_stats(db, days)
        rows = [
            ["Total Waste Records", str(stats['total_records'])],
            ["Total Waste Quantity", f"{stats['total_waste_kg']} kg"],
        ]
        for waste_type, kg in stats['waste_types'].items():
            rows.append([waste_type.replace("_", " ").title(), f"{round(kg, 2)} kg"])

        elements = [
            Paragraph("Waste Management", styles['heading']),
            cls._metric_table(rows, cls.COLORS['warning']),
            Spacer(1, 0.3*inch),
        ]
        if detailed and stats["waste_list"]:
            elements.append(cls._detail_table(
                ["Date", "Type", "Qty (kg)", "Classification", "Disposal"],
                [[str(w.waste_date), w.waste_type, f"{w.quantity_kg:g}", w.classification,
                  w.disposal_method or "-"] for w in stats["waste_list"]]
            ))
            elements.append(Spacer(1, 0.3*inch))
        return elements

    @classmethod
    def generate_report(
        cls,
        db: Session,
        user: User,
        report_type: str = "summary",
        days: int = 30
    ) -> Tuple[BytesIO, str]:
        """
        Generate a PDF report

        Args:
            db: Database session
            user: User requesting the report
            report_type: One of REPORT_SECTIONS (harvest, transport, waste, analytics, summary, full)
            days: Number of days to include in report

        Returns:
            Tuple of (BytesIO buffer, filename)
        """
        if report_type not in cls.REPORT_SECTIONS:
            raise ValueError(f"Unknown report type. Must be one of: {', '.join(cls.REPORT_SECTIONS)}")

        sections = cls.REPORT_SECTIONS[report_type]
        # Single-module reports and the full report list the individual records
        detailed = len(sections) == 1 or report_type == "full"

        buffer = BytesIO()
        filename = f"pinetrack_{report_type}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=0.75*inch,
            bottomMargin=0.75*inch
        )
        styles = cls._create_styles()
        elements = []

        elements.append(Paragraph(f"PineTrack V2.0 - {cls.REPORT_TITLES[report_type]}", styles['title']))
        elements.append(Spacer(1, 0.2*inch))

        info_data = [
            ["Report Generated:", datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
            ["Generated By:", user.full_name or user.username],
            ["Report Period:", f"Last {days} days"],
            ["Organization:", "Farm Management System"]
        ]
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), cls.COLORS['light']),
            ('TEXTCOLOR', (0, 0), (-1, -1), cls.COLORS['dark']),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 0.3*inch))

        builders = {
            "harvest": cls._harvest_section,
            "transport": cls._transport_section,
            "waste": cls._waste_section,
        }
        for section in sections:
            elements.extend(builders[section](db, days, styles, detailed))

        elements.append(Paragraph(
            f"<i>Report generated by PineTrack V2.0 Farm Management System on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</i>",
            styles['normal']
        ))

        doc.build(elements)
        buffer.seek(0)

        logger.info(f"Report generated: {filename}")
        return buffer, filename
