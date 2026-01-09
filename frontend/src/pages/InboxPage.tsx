import React, { useEffect, useState } from 'react';

import { AlertCircle, CheckCircle, Clock, Eye, MessageCircle, Plus, Send, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { BUTTON_SIZES } from '@/constants/designSystem';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { supportService } from '@/services/api/services/supportService';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { PageLoader } from '@/shared/components/ui/loader';
import { Textarea } from '@/shared/components/ui/textarea';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import PageWrapper from '../shared/components/PageWrapper';

import type { ApiResponse } from '@/types/api';

interface Ticket {
  id: number;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'closed';
  unread_responses: number;
  created_at: string;
  updated_at: string;
}

interface TicketResponse {
  id: number;
  message: string;
  is_admin_response: boolean;
  is_read: boolean;
  created_at: string;
}

interface CreateFormData {
  subject: string;
  message: string;
}

interface CreateFormErrors {
  subject?: string;
  message?: string;
}

const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [newResponse, setNewResponse] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const [createFormData, setCreateFormData] = useState<CreateFormData>({
    subject: '',
    message: ''
  });
  const [createFormErrors, setCreateFormErrors] = useState<CreateFormErrors>({});
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const validateCreateForm = (data: CreateFormData): CreateFormErrors => {
    const errors: CreateFormErrors = {};

    if (!data.subject.trim()) {
      errors.subject = '���� �����������';
    } else if (data.subject.length < 3) {
      errors.subject = '������� 3 �������';
    } else if (data.subject.length > 100) {
      errors.subject = '�������� 100 ��������';
    }

    if (!data.message.trim()) {
      errors.message = '��������� �����������';
    } else if (data.message.length < 10) {
      errors.message = '������� 10 ��������';
    } else if (data.message.length > 5000) {
      errors.message = '�������� 5000 ��������';
    }

    return errors;
  };

  const loadTickets = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await supportService.getMyTickets();
      const result = response.data as ApiResponse<{ tickets?: Ticket[] }>;
      setTickets(result.data?.tickets || []);
    } catch (error: unknown) {
      const err = error as { status?: number };
      logger.error('Error loading tickets:', error);
      const errorMsg = err.status === 503
        ? '������ �� ������������. ���������� �����.'
        : '�� ������� ��������� ������. ��������� ��������-����������.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadTicketResponses = async (ticketId: number): Promise<void> => {
    try {
      const response = await supportService.getTicketResponses(ticketId);
      const result = response.data as ApiResponse<{ responses?: TicketResponse[] }>;
      setResponses(result.data?.responses || []);
    } catch (error) {
      logger.error('Error loading responses:', error);
      toast.error('������ ��� �������� �������');
    }
  };

  const handleTicketClick = (ticket: Ticket): void => {
    setSelectedTicket(ticket);
    loadTicketResponses(ticket.id);
    setIsDialogOpen(true);
  };

  const handleSendResponse = async (): Promise<void> => {
    if (!newResponse.trim() || !selectedTicket) return;

    const messageText = newResponse;

    const optimisticResponse: TicketResponse = {
      id: Date.now(),
      message: messageText,
      is_admin_response: false,
      is_read: true,
      created_at: new Date().toISOString()
    };

    setResponses(prev => [...prev, optimisticResponse]);
    setNewResponse('');
    toast.success('����� ���������');

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('message', messageText);

      await supportService.respondToTicket(selectedTicket.id, formData);
      await loadTicketResponses(selectedTicket.id);
      await loadTickets();
    } catch (error) {
      setResponses(prev => prev.filter(r => r.id !== optimisticResponse.id));
      logger.error('Error sending response:', error);
      toast.error('������ ��� �������� ������');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!createFormData.subject.trim() || !createFormData.message.trim()) {
      toast.error('��������� ��� ����');
      return;
    }

    const optimisticTicket: Ticket = {
      id: Date.now(),
      subject: createFormData.subject,
      message: createFormData.message,
      status: 'open',
      unread_responses: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setTickets(prev => [optimisticTicket, ...prev]);
    setIsCreateDialogOpen(false);
    setCreateFormData({ subject: '', message: '' });
    toast.success('����� ������');

    setIsCreating(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('subject', createFormData.subject);
      formDataToSend.append('message', createFormData.message);

      const response = await supportService.createTicket(formDataToSend);
      const result = response.data as ApiResponse<{ ticket_id?: number }>;
      toast.success(`����� #${result.data?.ticket_id} ������� ������!`);
      await loadTickets();
    } catch (error) {
      setTickets(prev => prev.filter(t => t.id !== optimisticTicket.id));
      logger.error('Error creating ticket:', error);
      toast.error('������ ��� �������� ������');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateInputChange = (field: keyof CreateFormData, value: string): void => {
    const newData = { ...createFormData, [field]: value };
    setCreateFormData(newData);

    const errors = validateCreateForm(newData);
    setCreateFormErrors(errors);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const getStatusBadge = (status: Ticket['status']): React.ReactNode => {
    const statusConfig = {
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

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalUnread = tickets.reduce((sum, ticket) => sum + ticket.unread_responses, 0);

  if (!isAuthenticated) {
    return (
      <PageWrapper title="��������">
        <Card className="border-gray-700">
          <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-gray-500" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold text-gray-200">
                ��������� �����������
              </h3>
              <p className="text-gray-400 text-sm">
                ��� ������� � �������� ���������� ���������� ����� � �������
              </p>
            </div>
            <Button
              onClick={() => navigate('/login')}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              ����� � �������
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-6 text-foreground">��� ������</h1>
          <p className="text-muted-foreground">
            ���� ��������� � ������ ���������
            {totalUnread > 0 && (
              <span className="ml-2 text-primary font-semibold">
                ({totalUnread} �������������)
              </span>
            )}
          </p>
        </div>

        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          ������� �����
        </Button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <PageLoader message="�������� �������..." />
        ) : tickets.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-12 text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">��� ������� ���������</h3>
              <p className="text-muted-foreground mb-6">
                ��� ������! [SUCCESS] � ��� ���� ��� ��������� � ������ ���������.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                ������� ������ �����
              </Button>
            </CardContent>
          </Card>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={`hover:shadow-md transition-shadow cursor-pointer rounded-lg border bg-card text-card-foreground shadow-sm ${ticket.unread_responses > 0 ? 'border-primary bg-primary/5' : ''
                }`}
              onClick={() => handleTicketClick(ticket)}
            >
              <Card className="border-0 shadow-none bg-transparent">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">#{ticket.id} {ticket.subject}</h3>
                        {getStatusBadge(ticket.status)}
                        {ticket.unread_responses > 0 && (
                          <Badge variant="destructive">
                            {ticket.unread_responses} �����
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground mb-3">
                        <p><strong>������:</strong> {formatDate(ticket.created_at)}</p>
                        <p><strong>��������:</strong> {formatDate(ticket.updated_at)}</p>
                      </div>

                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap line-clamp-3 break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{ticket.message}</p>
                      </div>
                    </div>

                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      �������
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              ����� #{selectedTicket?.id}
            </DialogTitle>
            <DialogDescription>
              {selectedTicket?.subject}
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(selectedTicket.status)}
                  <span className="text-sm text-muted-foreground">
                    ������: {formatDate(selectedTicket.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{selectedTicket.message}</p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">���������:</h4>
                {responses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">���� ��� �������</p>
                ) : (
                  responses.map((response) => (
                    <div
                      key={response.id}
                      className={`p-3 rounded-lg ${response.is_admin_response
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-green-50 border border-green-200'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {response.is_admin_response ? '�������������' : '��'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(response.created_at)}
                          </span>
                        </div>
                        {response.is_admin_response && !response.is_read && (
                          <Badge variant="destructive" className="text-xs">
                            �����
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{response.message}</p>
                    </div>
                  ))
                )}
              </div>

              {selectedTicket.status !== 'closed' && (
                <div className="space-y-3">
                  <h4 className="font-semibold">��������:</h4>
                  <Textarea
                    placeholder="������� ��� �����..."
                    value={newResponse}
                    onChange={(e) => setNewResponse(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSendResponse}
                      disabled={!newResponse.trim() || isSubmitting}
                      className="min-w-[100px]"
                    >
                      {isSubmitting ? (
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
              )}

              {selectedTicket.status === 'closed' && (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle className={cn(BUTTON_SIZES.iconSm, "mx-auto mb-2")} />
                  <p>���� ����� ������. �������� ����� ����� ��� �������������� ��������.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              �������� �����
            </DialogTitle>
            <DialogDescription>
              ������� �������� ��� ������. �� ������� � ���� �� �������.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-subject">���� *</Label>
              <Input
                id="create-subject"
                placeholder="������� �������� ��������"
                value={createFormData.subject}
                onChange={(e) => handleCreateInputChange('subject', e.target.value)}
                maxLength={100}
                required
                className={createFormErrors.subject ? 'border-red-500' : ''}
              />
              {createFormErrors.subject && (
                <p className="text-red-500 text-sm">{createFormErrors.subject}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-message">��������� *</Label>
              <Textarea
                id="create-message"
                placeholder="�������� ������� ��������, ��� � ������������� � � ��� ����� ������..."
                value={createFormData.message}
                onChange={(e) => handleCreateInputChange('message', e.target.value)}
                maxLength={5000}
                rows={6}
                required
                className={createFormErrors.message ? 'border-red-500' : ''}
              />
              {createFormErrors.message && (
                <p className="text-red-500 text-sm">{createFormErrors.message}</p>
              )}
              <div className="text-sm text-muted-foreground text-right">
                {createFormData.message.length}/5000 ��������
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreating}
              >
                ������
              </Button>
              <Button
                type="submit"
                disabled={isCreating || Object.keys(createFormErrors).length > 0}
                className="min-w-[100px]"
                title={Object.keys(createFormErrors).length > 0 ? '��������� ������ ����� ���������' : ''}
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    ��������...
                  </>
                ) : Object.keys(createFormErrors).length > 0 ? (
                  '��������� ������'
                ) : (
                  '���������'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default InboxPage;

