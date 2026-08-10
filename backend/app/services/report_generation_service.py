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
        cutoff_date = datetime.now() - timedelta(days=days)
        
        harvests = db.query(Harvest).filter(Harvest.created_at >= cutoff_date).all()
        
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
            quality_dist[h.quality_grade] = quality_dist.get(h.quality_grade, 0) + 1
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
        cutoff_date = datetime.now() - timedelta(days=days)
        
        transports = db.query(Transport).filter(Transport.created_at >= cutoff_date).all()
        
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
        cutoff_date = datetime.now() - timedelta(days=days)
        
        waste_records = db.query(Waste).filter(Waste.created_at >= cutoff_date).all()
        
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
    
    @classmethod
    def generate_summary_report(
        cls,
        db: Session,
        user: User,
        days: int = 30
    ) -> Tuple[BytesIO, str]:
        """
        Generate comprehensive summary report
        
        Args:
            db: Database session
            user: User requesting the report
            days: Number of days to include in report
            
        Returns:
            Tuple of (BytesIO buffer, filename)
        """
        try:
            # Get statistics
            harvest_stats = cls.get_harvest_stats(db, days)
            transport_stats = cls.get_transport_stats(db, days)
            waste_stats = cls.get_waste_stats(db, days)
            
            # Create PDF document
            buffer = BytesIO()
            filename = f"pinetrack_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            
            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                rightMargin=0.75*inch,
                leftMargin=0.75*inch,
                topMargin=0.75*inch,
                bottomMargin=0.75*inch
            )
            
            # Get styles
            styles = cls._create_styles()
            
            # Build document content
            elements = []
            
            # Header
            elements.append(Paragraph("🍍 PineTrack V2.0 Report", styles['title']))
            elements.append(Spacer(1, 0.2*inch))
            
            # Report info
            info_data = [
                ["Report Generated:", datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
                ["Generated By:", user.full_name],
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
            
            # Harvest Section
            elements.append(Paragraph("Harvest Management", styles['heading']))
            harvest_data = [
                ["Metric", "Value"],
                ["Total Harvests", str(harvest_stats['total_harvests'])],
                ["Total Quantity", f"{harvest_stats['total_quantity_kg']} kg"],
                ["Average per Harvest", f"{harvest_stats['average_quantity']} kg"],
            ]
            
            # Add quality distribution
            for grade, count in harvest_stats['quality_distribution'].items():
                harvest_data.append([f"Grade {grade}", str(count)])
            
            harvest_table = Table(harvest_data, colWidths=[2.5*inch, 2*inch])
            harvest_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), cls.COLORS['primary']),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), cls.COLORS['light']),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, cls.COLORS['light']])
            ]))
            elements.append(harvest_table)
            elements.append(Spacer(1, 0.3*inch))
            
            # Transport Section
            elements.append(Paragraph("Transport & Logistics", styles['heading']))
            transport_data = [
                ["Metric", "Value"],
                ["Total Transports", str(transport_stats['total_transports'])],
                ["Delivered", str(transport_stats['delivered_count'])],
                ["In Transit", str(transport_stats['in_transit_count'])],
                ["Pending", str(transport_stats['pending_count'])],
                ["Delivery Rate", f"{transport_stats['delivery_rate']}%"],
            ]
            
            transport_table = Table(transport_data, colWidths=[2.5*inch, 2*inch])
            transport_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), cls.COLORS['secondary']),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), cls.COLORS['light']),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, cls.COLORS['light']])
            ]))
            elements.append(transport_table)
            elements.append(Spacer(1, 0.3*inch))
            
            # Waste Section
            elements.append(Paragraph("Waste Management", styles['heading']))
            waste_data = [
                ["Metric", "Value"],
                ["Total Waste Records", str(waste_stats['total_records'])],
                ["Total Waste Quantity", f"{waste_stats['total_waste_kg']} kg"],
            ]
            
            for waste_type, kg in waste_stats['waste_types'].items():
                waste_data.append([f"{waste_type.title()}", f"{kg} kg"])
            
            waste_table = Table(waste_data, colWidths=[2.5*inch, 2*inch])
            waste_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), cls.COLORS['warning']),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), cls.COLORS['light']),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, cls.COLORS['light']])
            ]))
            elements.append(waste_table)
            elements.append(Spacer(1, 0.3*inch))
            
            # Footer
            elements.append(Paragraph(
                f"<i>Report generated by PineTrack V2.0 Farm Management System on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</i>",
                styles['normal']
            ))
            
            # Build PDF
            doc.build(elements)
            buffer.seek(0)
            
            logger.info(f"Report generated: {filename}")
            return buffer, filename
            
        except Exception as e:
            logger.error(f"Error generating report: {str(e)}")
            raise
    
    @classmethod
    def generate_harvest_report(
        cls,
        db: Session,
        user: User,
        days: int = 30
    ) -> Tuple[BytesIO, str]:
        """Generate detailed harvest analysis report"""
        try:
            buffer = BytesIO()
            filename = f"harvest_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            
            doc = SimpleDocTemplate(buffer, pagesize=letter)
            styles = cls._create_styles()
            elements = []
            
            harvest_stats = cls.get_harvest_stats(db, days)
            
            elements.append(Paragraph("Harvest Analysis Report", styles['title']))
            elements.append(Spacer(1, 0.2*inch))
            elements.append(Paragraph(f"Period: Last {days} days", styles['normal']))
            elements.append(Spacer(1, 0.2*inch))
            
            # Summary
            summary = f"""
            This report covers harvest operations over the last {days} days.
            Total harvests recorded: <b>{harvest_stats['total_harvests']}</b><br/>
            Total production: <b>{harvest_stats['total_quantity_kg']} kg</b><br/>
            Average harvest size: <b>{harvest_stats['average_quantity']} kg</b>
            """
            elements.append(Paragraph(summary, styles['body']))
            
            doc.build(elements)
            buffer.seek(0)
            
            return buffer, filename
        except Exception as e:
            logger.error(f"Error generating harvest report: {str(e)}")
            raise
