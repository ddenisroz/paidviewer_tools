import React, { useEffect, useState } from 'react';

import { AlertCircle, Archive, CheckCircle, Clock, Eye, MessageCircle, Search, Send } from 'lucide-react';

import { supportService } from '@/services/api/services/supportService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { PageLoader } from '@/shared/components/ui/loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';


import type { ApiResponse } from '../../../types';

interface Ticket {
  id: number;
  subject: string;
  message: string;
  user_name: string;
  user_email?: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
  admin_notes?: string;
  is_archived?: boolean;
}

interface Response {
  id: number;
  message: string;
  is_admin_response: boolean;
  created_at: string;
  is_read?: boolean;
}

type StatusFilter = 'all' | 'open' | 'in_progress' | 'closed';

const SupportTicketsPage: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [newStatus, setNewStatus] = useState<'open' | 'in_progress' | 'closed'>('open');
  const [responses, setResponses] = useState<Response[]>([]);
  const [newResponse, setNewResponse] = useState<string>('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState<boolean>(false);

  const loadTickets = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await supportService.getAdminTickets({ status: statusFilter });
      const data = response.data as ApiResponse<{ tickets?: Ticket[] }>;
      setTickets(data.data?.tickets || []);
    } catch (error) {
      logger.error('Error loading tickets:', error);
      toast.error('������ ��� �������� �������');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [statusFilter]);

  const loadTicketResponses = async (ticketId: number): Promise<void> => {
    try {
      const response = await supportService.getAdminTicket(ticketId);
      const data = response.data as ApiResponse<{ responses?: Response[] }>;
      setResponses(data.data?.responses || []);
    } catch (error) {
      logger.error('Error loading responses:', error);
      toast.error('������ ��� �������� �������');
    }
  };

  const handleSendResponse = async (): Promise<void> => {
    if (!newResponse.trim() || !selectedTicket) return;

    setIsSubmittingResponse(true);
    try {
      const response = await supportService.sendAdminResponse(selectedTicket.id, newResponse);

      if (response && typeof response === 'object' && 'ok' in response && response.ok) {
        toast.success('����� ���������');
        setNewResponse('');
        loadTicketResponses(selectedTicket.id);
        loadTickets();
      } else {
        toast.error('������ ��� �������� ������');
      }
    } catch (error) {
      logger.error('Error sending response:', error);
      toast.error('������ ��� �������� ������');
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const handleUpdateTicket = async (): Promise<void> => {
    if (!selectedTicket) return;

    try {
      await supportService.updateTicketStatus(selectedTicket.id, {
        status: newStatus,
        admin_notes: adminNotes
      });
      toast.success('����� ��������');
      setIsDialogOpen(false);
      setSelectedTicket(null);
      setAdminNotes('');
      loadTickets();
    } catch (error) {
      logger.error('Error updating ticket:', error);
      toast.error('������ ��� ���������� ������');
    }
  };

  const handleArchiveTicket = async (ticketId: number): Promise<void> => {
    try {
      await supportService.deleteTicket(ticketId);

      setTickets(prev => prev.map(ticket => 
        ticket.id === ticketId ? { ...ticket, is_archived: true } : ticket
      ));
      toast.success('����� �����������');
      loadTickets();
    } catch (error) {
      logger.error('Error archiving ticket:', error);
      toast.error('������ ������������� ������');
    }
  };

  const handleUnarchiveTicket = async (ticketId: number): Promise<void> => {
    try {
      await supportService.unarchiveTicket(ticketId);

      setTickets(prev => prev.map(ticket => 
        ticket.id === ticketId ? { ...ticket, is_archived: false } : ticket
      ));
      toast.success('����� �������� �� ������');
    } catch (error) {
      logger.error('Error unarchiving ticket:', error);
      toast.error('������ ���������� ������ �� ������');
    }
  };

  const getStatusBadge = (status: string): React.ReactNode => {
    const statusConfig: Record<string, { color: string; icon: React.ComponentType<{ className?: string }>; text: string }> = {
      open: { color: 'bg-blue-500', icon: Clock, text: '������' },
      in_progress: { color: 'bg-yellow-500', icon: AlertCircle, text: '� ������' },
      closed: { color: 'bg-green-500', icon: CheckCircle, text: '������' }
    };

    const config = statusConfig[status] || statusConfig.open;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.text}
      </Badge>
    );
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesArchive = showArchived ? ticket.is_archived : !ticket.is_archived;
    
    return matchesSearch && matchesArchive;
  });

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="����� �� ����, ��������� ��� �����..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="������" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">��� �������</SelectItem>
                <SelectItem value="open">��������</SelectItem>
                <SelectItem value="in_progress">� ������</SelectItem>
                <SelectItem value="closed">��������</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={() => setShowArchived(!showArchived)} 
              variant={showArchived ? "default" : "outline"}
              className="flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              {showArchived ? '������ �����' : '�������� �����'}
            </Button>
            <Button onClick={loadTickets} variant="outline">
              ��������
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <PageLoader message="�������� �������..." />
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">������ �� �������</h3>
              <p className="text-muted-foreground">
                {searchTerm ? '���������� �������� ��������� ������' : '���� ��� ������� ���������'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">#{ticket.id} {ticket.subject}</h3>
                      {getStatusBadge(ticket.status)}
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-3">
                      <p><strong>��:</strong> {ticket.user_name} {ticket.user_email && `(${ticket.user_email})`}</p>
                      <p><strong>������:</strong> {formatDate(ticket.created_at)}</p>
                      {ticket.updated_at !== ticket.created_at && (
                        <p><strong>��������:</strong> {formatDate(ticket.updated_at)}</p>
                      )}
                    </div>

                    <div className="bg-gray-800/50 border border-gray-600/30 p-3 rounded-lg mb-3">
                      <p className="text-sm text-white whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{ticket.message}</p>
                    </div>

                    {ticket.admin_notes && (
                      <div className="bg-blue-900 border border-blue-500 p-3 rounded-lg mb-3">
                        <p className="text-sm font-medium text-white mb-1">������� ��������������:</p>
                        <p className="text-sm text-white whitespace-pre-wrap">{ticket.admin_notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setNewStatus(ticket.status);
                        setAdminNotes(ticket.admin_notes || '');
                        setNewResponse('');
                        loadTicketResponses(ticket.id);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      ����������
                    </Button>
                    {ticket.status === 'closed' && !ticket.is_archived && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchiveTicket(ticket.id)}
                        className="text-orange-600 hover:text-orange-700"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        ������������
                      </Button>
                    )}
                    {ticket.is_archived && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnarchiveTicket(ticket.id)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        �� ������
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>���������� ������� #{selectedTicket?.id}</DialogTitle>
            <DialogDescription>
              �������� ������ ������ � �������� �������
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              <div>
                <Label>����</Label>
                <p className="font-medium">{selectedTicket.subject}</p>
              </div>

              <div>
                <Label>���������</Label>
                <div className="bg-gray-800/50 border border-gray-600/30 p-3 rounded-lg">
                  <p className="text-sm text-white whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{selectedTicket.message}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>���������:</Label>
                {responses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">���� ��� �������</p>
                ) : (
                  responses.map((response) => (
                    <div
                      key={response.id}
                      className={`p-3 rounded-lg ${
                        response.is_admin_response
                          ? 'bg-blue-900 border border-blue-500'
                          : 'bg-green-900 border border-green-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white">
                            {response.is_admin_response ? '�������������' : '������������'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(response.created_at)}
                          </span>
                        </div>
                        {response.is_admin_response && !response.is_read && (
                          <Badge variant="destructive" className="text-xs">
                            �� ���������
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-white whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{response.message}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="admin_response">����� ������������:</Label>
                <Textarea
                  id="admin_response"
                  placeholder="������� ����� ������������..."
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendResponse}
                    disabled={!newResponse.trim() || isSubmittingResponse}
                    className="min-w-[100px]"
                  >
                    {isSubmittingResponse ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        ��������...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        ���������
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="status">������</Label>
                <Select value={newStatus} onValueChange={(value) => setNewStatus(value as 'open' | 'in_progress' | 'closed')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">������</SelectItem>
                    <SelectItem value="in_progress">� ������</SelectItem>
                    <SelectItem value="closed">������</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="admin_notes">������� ��������������</Label>
                <Textarea
                  id="admin_notes"
                  placeholder="�������� ������� � ������� ��������..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  ������
                </Button>
                <Button onClick={handleUpdateTicket}>
                  ��������� ���������
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportTicketsPage;



