import React, { useEffect, useMemo, useState } from 'react';

import { AlertCircle, CheckCircle, Clock, Eye, MessageCircle, Plus, Send, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { supportService } from '@/services/api/services/supportService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
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

const defaultCreateForm: CreateFormData = {
  subject: '',
  message: '',
};

const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [newResponse, setNewResponse] = useState('');

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateFormData>(defaultCreateForm);

  const totalUnread = useMemo(() => tickets.reduce((sum, ticket) => sum + ticket.unread_responses, 0), [tickets]);

  const formatDate = (dateString: string): string =>
    new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getStatusBadge = (status: Ticket['status']): React.ReactNode => {
    const statusConfig = {
      open: { color: 'bg-blue-500', icon: Clock, text: 'Открыт' },
      in_progress: { color: 'bg-yellow-500', icon: AlertCircle, text: 'В работе' },
      closed: { color: 'bg-green-500', icon: CheckCircle, text: 'Закрыт' },
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

  const loadTickets = async (showLoader = true): Promise<void> => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const response = await supportService.getMyTickets();
      const result = response.data as ApiResponse<{ tickets?: Ticket[] }>;
      setTickets(result.data?.tickets || []);
    } catch (error: unknown) {
      logger.error('Error loading tickets:', error);
      toast.error('Не удалось загрузить тикеты. Попробуйте обновить страницу.');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const loadTicketResponses = async (ticketId: number): Promise<void> => {
    try {
      const response = await supportService.getTicketResponses(ticketId);
      const result = response.data as ApiResponse<{ responses?: TicketResponse[] }>;
      setResponses(result.data?.responses || []);
    } catch (error) {
      logger.error('Error loading ticket responses:', error);
      toast.error('Не удалось загрузить ответы по тикету.');
    }
  };

  const handleTicketClick = (ticket: Ticket): void => {
    setSelectedTicket(ticket);
    setIsViewDialogOpen(true);
    void loadTicketResponses(ticket.id);
  };

  const handleSendResponse = async (): Promise<void> => {
    if (!selectedTicket || !newResponse.trim()) return;

    const messageText = newResponse.trim();
    setNewResponse('');
    setIsSubmitting(true);

    const optimisticResponse: TicketResponse = {
      id: Date.now(),
      message: messageText,
      is_admin_response: false,
      is_read: true,
      created_at: new Date().toISOString(),
    };
    setResponses(prev => [...prev, optimisticResponse]);

    try {
      const formData = new FormData();
      formData.append('message', messageText);
      await supportService.respondToTicket(selectedTicket.id, formData);
      await loadTicketResponses(selectedTicket.id);
      await loadTickets(false);
      toast.success('Ответ отправлен.');
    } catch (error) {
      logger.error('Error sending response:', error);
      setResponses(prev => prev.filter(item => item.id !== optimisticResponse.id));
      toast.error('Не удалось отправить ответ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTicket = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!createFormData.subject.trim() || !createFormData.message.trim()) {
      toast.error('Заполните тему и сообщение.');
      return;
    }

    if (createFormData.subject.trim().length < 3) {
      toast.error('Тема должна содержать минимум 3 символа.');
      return;
    }

    if (createFormData.message.trim().length < 10) {
      toast.error('Сообщение должно содержать минимум 10 символов.');
      return;
    }

    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append('subject', createFormData.subject.trim());
      formData.append('message', createFormData.message.trim());

      const response = await supportService.createTicket(formData);
      const result = response.data as ApiResponse<{ ticket_id?: number }>;

      setIsCreateDialogOpen(false);
      setCreateFormData(defaultCreateForm);
      await loadTickets(false);
      toast.success(`Тикет #${result.data?.ticket_id ?? ''} создан.`);
    } catch (error) {
      logger.error('Error creating ticket:', error);
      toast.error('Не удалось создать тикет.');
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  if (!isAuthenticated) {
    return (
      <PageWrapper title="Поддержка">
        <Card className="card-glass border-border">
          <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold text-foreground">Требуется авторизация</h3>
              <p className="text-muted-foreground text-sm">Для работы с тикетами нужно войти в систему.</p>
            </div>
            <Button onClick={() => navigate('/login')} className="gap-2">
              <Settings className="w-4 h-4" />
              Войти в систему
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-foreground">Мои тикеты</h1>
          {totalUnread > 0 && <Badge variant="destructive">{totalUnread} непрочитанных</Badge>}
        </div>

        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Создать тикет
        </Button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <PageLoader message="Загрузка тикетов..." />
        ) : tickets.length === 0 ? (
          <Card className="card-glass border-dashed border-2 border-border">
            <CardContent className="p-12 text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Нет активных тикетов</h3>
              <Button onClick={() => setIsCreateDialogOpen(true)} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Создать первый тикет
              </Button>
            </CardContent>
          </Card>
        ) : (
          tickets.map(ticket => (
            <div
              key={ticket.id}
              className={`hover:shadow-md transition-shadow cursor-pointer rounded-lg border bg-card text-card-foreground shadow-sm ${
                ticket.unread_responses > 0 ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => handleTicketClick(ticket)}
            >
              <Card className="border-0 shadow-none bg-transparent">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-lg">
                          #{ticket.id} {ticket.subject}
                        </h3>
                        {getStatusBadge(ticket.status)}
                        {ticket.unread_responses > 0 && (
                          <Badge variant="destructive">{ticket.unread_responses} новых</Badge>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground mb-3">
                        <p>
                          <strong>Создан:</strong> {formatDate(ticket.created_at)}
                        </p>
                        <p>
                          <strong>Обновлен:</strong> {formatDate(ticket.updated_at)}
                        </p>
                      </div>

                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap line-clamp-3 break-words">{ticket.message}</p>
                      </div>
                    </div>

                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Открыть
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTicket ? `Тикет #${selectedTicket.id}: ${selectedTicket.subject}` : 'Тикет'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {selectedTicket && (
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground mb-3">
                    <p>
                      <strong>Статус:</strong> {getStatusBadge(selectedTicket.status)}
                    </p>
                    <p>
                      <strong>Создан:</strong> {formatDate(selectedTicket.created_at)}
                    </p>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap break-words">{selectedTicket.message}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <h4 className="font-semibold">Ответы</h4>
              {responses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ответов пока нет.</p>
              ) : (
                responses.map(response => (
                  <div
                    key={response.id}
                    className={`rounded-lg p-3 border ${
                      response.is_admin_response ? 'bg-primary/10 border-primary/20' : 'bg-muted border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">
                        {response.is_admin_response ? 'Поддержка' : 'Вы'}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(response.created_at)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{response.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-reply">Ответ</Label>
              <Textarea
                id="ticket-reply"
                value={newResponse}
                onChange={event => setNewResponse(event.target.value)}
                placeholder="Введите сообщение..."
                className="min-h-[100px]"
              />
              <div className="flex justify-end">
                <Button onClick={handleSendResponse} disabled={isSubmitting || !newResponse.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Отправка...' : 'Отправить'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Создать тикет</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-subject">Тема</Label>
              <Input
                id="ticket-subject"
                value={createFormData.subject}
                onChange={event => setCreateFormData(prev => ({ ...prev, subject: event.target.value }))}
                placeholder="Кратко опишите проблему"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">{createFormData.subject.length}/100</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-message">Сообщение</Label>
              <Textarea
                id="ticket-message"
                value={createFormData.message}
                onChange={event => setCreateFormData(prev => ({ ...prev, message: event.target.value }))}
                placeholder="Опишите проблему подробнее"
                className="min-h-[140px]"
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground">{createFormData.message.length}/5000</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Создание...' : 'Создать'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InboxPage;
