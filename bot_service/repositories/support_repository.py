# bot_service/repositories/support_repository.py
"""
Repository for Support Ticket entities.
Clean Architecture: abstracts DB access for support system.
"""

import logging
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from repositories.base_repository import BaseRepository
from core.database import SupportTicket, TicketResponse
from core.datetime_utils import utcnow_naive

logger = logging.getLogger(__name__)


class SupportTicketRepository(BaseRepository[SupportTicket]):
    """Repository for SupportTicket entity."""
    
    def __init__(self, db: Session):
        super().__init__(SupportTicket, db)
    
    def get_by_user_id(
        self, 
        user_id: int, 
        status: str = None
    ) -> List[SupportTicket]:
        """Get tickets for a user, optionally filtered by status."""
        query = self.db.query(SupportTicket).filter(SupportTicket.user_id == user_id)
        if status:
            query = query.filter(SupportTicket.status == status)
        return query.order_by(SupportTicket.created_at.desc()).all()
    
    def get_all_tickets(self, status: str = None) -> List[SupportTicket]:
        """Get all tickets (admin only), optionally filtered by status."""
        query = self.db.query(SupportTicket)
        if status:
            query = query.filter(SupportTicket.status == status)
        return query.order_by(SupportTicket.created_at.desc()).all()
    
    def get_responses(self, ticket_id: int) -> List[TicketResponse]:
        """Get all responses for a ticket."""
        return self.db.query(TicketResponse).filter(
            TicketResponse.ticket_id == ticket_id
        ).order_by(TicketResponse.created_at.asc()).all()
    
    # --- New methods for admin/tickets.py ---
    
    def get_non_archived_paginated(
        self,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 50
    ) -> Tuple[List[SupportTicket], int]:
        """Get non-archived tickets with pagination.
        
        Returns:
            Tuple of (tickets list, total count)
        """
        query = self.db.query(SupportTicket).filter(SupportTicket.is_archived == False)
        
        if status and status.lower() in ["open", "in_progress", "closed"]:
            query = query.filter(SupportTicket.status == status.lower())
        
        total = query.count()
        offset = (page - 1) * limit
        tickets = query.order_by(SupportTicket.created_at.desc()).offset(offset).limit(limit).all()
        
        return tickets, total
    
    def create_ticket(
        self,
        user_id: Optional[int],
        user_name: Optional[str],
        subject: str,
        message: str,
        priority: str = "medium"
    ) -> SupportTicket:
        """Create a new support ticket."""
        ticket = SupportTicket(
            user_id=user_id,
            user_name=user_name,
            subject=subject,
            message=message,
            priority=priority,
            status="open"
        )
        self.db.add(ticket)
        self.db.commit()
        self.db.refresh(ticket)
        return ticket
    
    def update_status(
        self,
        ticket_id: int,
        status: str,
        admin_notes: Optional[str] = None
    ) -> Optional[SupportTicket]:
        """Update ticket status."""
        ticket = self.get_by_id(ticket_id)
        if not ticket:
            return None
        
        ticket.status = status.lower()
        ticket.updated_at = utcnow_naive()
        
        if status.lower() == "closed":
            ticket.closed_at = utcnow_naive()
        
        if admin_notes:
            ticket.admin_notes = admin_notes
        
        self.db.commit()
        return ticket
    
    def add_response(
        self,
        ticket_id: int,
        author_id: int,
        author_name: str,
        message: str,
        is_admin_response: bool = False
    ) -> TicketResponse:
        """Add a response to a ticket."""
        response = TicketResponse(
            ticket_id=ticket_id,
            author_id=author_id,
            author_name=author_name,
            message=message,
            is_admin_response=is_admin_response
        )
        self.db.add(response)
        
        # Update ticket's updated_at
        ticket = self.get_by_id(ticket_id)
        if ticket:
            ticket.updated_at = utcnow_naive()
        
        self.db.commit()
        return response
    
    def archive(self, ticket_id: int) -> bool:
        """Archive a ticket (soft delete)."""
        ticket = self.get_by_id(ticket_id)
        if not ticket:
            return False
        
        ticket.is_archived = True
        self.db.commit()
        return True
