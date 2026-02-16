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

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/75 backdrop-blur-sm shadow-none';
const ACTION_BUTTON_CLASS = 'h-9 border-border/70 hover:bg-muted/60 shadow-none';

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

  const loadTickets = React.useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await supportService.getAdminTickets({ status: statusFilter });
      const data = response.data as ApiResponse<{ tickets?: Ticket[] }>;
      setTickets(data.data?.tickets || []);
    } catch (error) {
      logger.error('Error loading tickets:', error);
      toast.error('РћС€РёР±РєР° РїСЂРё Р·Р°РіСЂСѓР·РєРµ С‚РёРєРµС‚РѕРІ');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const loadTicketResponses = async (ticketId: number): Promise<void> => {
    try {
      const response = await supportService.getAdminTicket(ticketId);
      const data = response.data as ApiResponse<{ responses?: Response[] }>;
      setResponses(data.data?.responses || []);
    } catch (error) {
      logger.error('Error loading responses:', error);
      toast.error('РћС€РёР±РєР° РїСЂРё Р·Р°РіСЂСѓР·РєРµ РѕС‚РІРµС‚РѕРІ');
    }
  };

  const handleSendResponse = async (): Promise<void> => {
    if (!newResponse.trim() || !selectedTicket) return;

    setIsSubmittingResponse(true);
    try {
      const response = await supportService.sendAdminResponse(selectedTicket.id, newResponse);

      if (response && typeof response === 'object' && 'ok' in response && response.ok) {
        toast.success('РћС‚РІРµС‚ РѕС‚РїСЂР°РІР»РµРЅ');
        setNewResponse('');
        loadTicketResponses(selectedTicket.id);
        loadTickets();
      } else {
        toast.error('РћС€РёР±РєР° РїСЂРё РѕС‚РїСЂР°РІРєРµ РѕС‚РІРµС‚Р°');
      }
    } catch (error) {
      logger.error('Error sending response:', error);
      toast.error('РћС€РёР±РєР° РїСЂРё РѕС‚РїСЂР°РІРєРµ РѕС‚РІРµС‚Р°');
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
      toast.success('РўРёРєРµС‚ РѕР±РЅРѕРІР»РµРЅ');
      setIsDialogOpen(false);
      setSelectedTicket(null);
      setAdminNotes('');
      loadTickets();
    } catch (error) {
      logger.error('Error updating ticket:', error);
      toast.error('РћС€РёР±РєР° РїСЂРё РѕР±РЅРѕРІР»РµРЅРёРё С‚РёРєРµС‚Р°');
    }
  };

  const handleArchiveTicket = async (ticketId: number): Promise<void> => {
    try {
      await supportService.deleteTicket(ticketId);

      setTickets(prev => prev.map(ticket =>
        ticket.id === ticketId ? { ...ticket, is_archived: true } : ticket
      ));
      toast.success('РўРёРєРµС‚ Р°СЂС…РёРІРёСЂРѕРІР°РЅ');
      loadTickets();
    } catch (error) {
      logger.error('Error archiving ticket:', error);
      toast.error('РћС€РёР±РєР° Р°СЂС…РёРІР°С†РёРё С‚РёРєРµС‚Р°');
    }
  };

  const handleUnarchiveTicket = async (ticketId: number): Promise<void> => {
    try {
      await supportService.unarchiveTicket(ticketId);

      setTickets(prev => prev.map(ticket =>
        ticket.id === ticketId ? { ...ticket, is_archived: false } : ticket
      ));
      toast.success('РўРёРєРµС‚ РІРѕР·РІСЂР°С‰РµРЅ РёР· Р°СЂС…РёРІР°');
    } catch (error) {
      logger.error('Error unarchiving ticket:', error);
      toast.error('РћС€РёР±РєР° РІРѕР·РІСЂР°С‚Р° С‚РёРєРµС‚Р° РёР· Р°СЂС…РёРІР°');
    }
  };

  const getStatusBadge = (status: string): React.ReactNode => {
    const statusConfig: Record<string, { color: string; icon: React.ComponentType<{ className?: string }>; text: string }> = {
      open: { color: 'border-blue-500/40 bg-blue-500/15 text-blue-200', icon: Clock, text: 'РћС‚РєСЂС‹С‚' },
      in_progress: { color: 'border-amber-500/40 bg-amber-500/10 text-amber-200', icon: AlertCircle, text: 'Р’ СЂР°Р±РѕС‚Рµ' },
      closed: { color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200', icon: CheckCircle, text: 'Р—Р°РєСЂС‹С‚' }
    };

    const config = statusConfig[status] || statusConfig.open;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
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
      <Card className={SURFACE_CARD_CLASS}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="РџРѕРёСЃРє РїРѕ С‚РµРјРµ, СЃРѕРѕР±С‰РµРЅРёСЋ РёР»Рё РёРјРµРЅРё..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 border-border/70 bg-card/60 pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="h-9 w-48 border-border/70 bg-card/60">
                <SelectValue placeholder="РЎС‚Р°С‚СѓСЃ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Р’СЃРµ СЃС‚Р°С‚СѓСЃС‹</SelectItem>
                <SelectItem value="open">РћС‚РєСЂС‹С‚</SelectItem>
                <SelectItem value="in_progress">Р’ СЂР°Р±РѕС‚Рµ</SelectItem>
                <SelectItem value="closed">Р—Р°РєСЂС‹С‚</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowArchived(!showArchived)}
              variant={showArchived ? "default" : "outline"}
              className={showArchived ? 'h-9 gap-2' : ACTION_BUTTON_CLASS}
            >
              <Archive className="h-4 w-4" />
              {showArchived ? 'РЎРєСЂС‹С‚СЊ Р°СЂС…РёРІ' : 'РџРѕРєР°Р·Р°С‚СЊ Р°СЂС…РёРІ'}
            </Button>
            <Button onClick={loadTickets} variant="outline" className={ACTION_BUTTON_CLASS}>
              РћР±РЅРѕРІРёС‚СЊ
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <PageLoader message="Р—Р°РіСЂСѓР·РєР° С‚РёРєРµС‚РѕРІ..." />
        ) : filteredTickets.length === 0 ? (
          <Card className={SURFACE_CARD_CLASS}>
            <CardContent className="p-8 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">РўРёРєРµС‚С‹ РЅРµ РЅР°Р№РґРµРЅС‹</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'РР·РјРµРЅРёС‚Рµ Р·Р°РїСЂРѕСЃ Рё РїРѕРїСЂРѕР±СѓР№С‚Рµ СЃРЅРѕРІР°' : 'РџРѕРєР° РЅРµС‚ РЅРѕРІС‹С… РѕР±СЂР°С‰РµРЅРёР№'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Card key={ticket.id} className={`${SURFACE_CARD_CLASS} transition-colors hover:bg-card/85`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">#{ticket.id} {ticket.subject}</h3>
                      {getStatusBadge(ticket.status)}
                    </div>

                    <div className="text-sm text-muted-foreground mb-3">
                      <p><strong>РћС‚:</strong> {ticket.user_name} {ticket.user_email && `(${ticket.user_email})`}</p>
                      <p><strong>РЎРѕР·РґР°РЅ:</strong> {formatDate(ticket.created_at)}</p>
                      {ticket.updated_at !== ticket.created_at && (
                        <p><strong>РћР±РЅРѕРІР»РµРЅ:</strong> {formatDate(ticket.updated_at)}</p>
                      )}
                    </div>

                    <div className="mb-3 rounded-lg border border-border/60 bg-card/60 p-3">
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{ticket.message}</p>
                    </div>

                    {ticket.admin_notes && (
                      <div className="mb-3 rounded-lg border border-blue-500/40 bg-blue-500/10 p-3">
                        <p className="mb-1 text-sm font-medium text-blue-200">Р—Р°РјРµС‚РєРё Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°:</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.admin_notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pl-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 border-border/70 hover:bg-muted/60"
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
                      РћС‚РєСЂС‹С‚СЊ
                    </Button>
                    {ticket.status === 'closed' && !ticket.is_archived && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchiveTicket(ticket.id)}
                        className="h-8 border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Р’ Р°СЂС…РёРІ
                      </Button>
                    )}
                    {ticket.is_archived && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnarchiveTicket(ticket.id)}
                        className="h-8 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        РР· Р°СЂС…РёРІР°
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
            <DialogTitle>РћР±СЂР°С‰РµРЅРёРµ #{selectedTicket?.id}</DialogTitle>
            <DialogDescription>
              РџСЂРѕСЃРјРѕС‚СЂ РґРёР°Р»РѕРіР° Рё СѓРїСЂР°РІР»РµРЅРёРµ С‚РёРєРµС‚РѕРј
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              <div>
                <Label>РўРµРјР°</Label>
                <p className="font-medium">{selectedTicket.subject}</p>
              </div>

              <div>
                <Label>РЎРѕРѕР±С‰РµРЅРёРµ</Label>
                <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{selectedTicket.message}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>РћС‚РІРµС‚С‹:</Label>
                {responses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">РћС‚РІРµС‚РѕРІ РїРѕРєР° РЅРµС‚</p>
                ) : (
                  responses.map((response) => (
                    <div
                      key={response.id}
                      className={`p-3 rounded-lg ${
                        response.is_admin_response
                          ? 'border border-blue-500/40 bg-blue-500/10'
                          : 'border border-emerald-500/40 bg-emerald-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {response.is_admin_response ? 'РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ' : 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(response.created_at)}
                          </span>
                        </div>
                        {response.is_admin_response && !response.is_read && (
                          <Badge variant="destructive" className="text-xs">
                            РќРµ РїСЂРѕС‡РёС‚Р°РЅРѕ
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{response.message}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="admin_response">РќРѕРІС‹Р№ РѕС‚РІРµС‚:</Label>
                <Textarea
                  id="admin_response"
                  placeholder="Р’РІРµРґРёС‚Рµ С‚РµРєСЃС‚ РѕС‚РІРµС‚Р°..."
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendResponse}
                    disabled={!newResponse.trim() || isSubmittingResponse}
                    className="h-9 min-w-[clamp(92px,18vw,120px)]"
                  >
                    {isSubmittingResponse ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        РћС‚РїСЂР°РІРєР°...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        РћС‚РїСЂР°РІРёС‚СЊ
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="status">РЎС‚Р°С‚СѓСЃ</Label>
                <Select value={newStatus} onValueChange={(value) => setNewStatus(value as 'open' | 'in_progress' | 'closed')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">РћС‚РєСЂС‹С‚</SelectItem>
                    <SelectItem value="in_progress">Р’ СЂР°Р±РѕС‚Рµ</SelectItem>
                    <SelectItem value="closed">Р—Р°РєСЂС‹С‚</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="admin_notes">Р—Р°РјРµС‚РєРё Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°</Label>
                <Textarea
                  id="admin_notes"
                  placeholder="Р”РѕР±Р°РІСЊС‚Рµ Р·Р°РјРµС‚РєРё Рє РѕР±СЂР°С‰РµРЅРёСЋ..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className={ACTION_BUTTON_CLASS} onClick={() => setIsDialogOpen(false)}>
                  РћС‚РјРµРЅР°
                </Button>
                <Button className="h-9" onClick={handleUpdateTicket}>
                  РЎРѕС…СЂР°РЅРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ
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

