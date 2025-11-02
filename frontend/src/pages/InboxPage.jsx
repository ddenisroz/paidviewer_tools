import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../constants';
import { MessageCircle, Clock, CheckCircle, AlertCircle, Reply, Send, Eye, EyeOff, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';

const InboxPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [responses, setResponses] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newResponse, setNewResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Состояние для создания тикетов
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    subject: '',
    message: ''
  });
  const [isCreating, setIsCreating] = useState(false);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/support/my-tickets`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
      } else {
        toast.error('Ошибка при загрузке тикетов');
      }
    } catch (error) {
      logger.error('Error loading tickets:', error);
      toast.error('Ошибка при загрузке тикетов');
    } finally {
      setLoading(false);
    }
  };

  const loadTicketResponses = async (ticketId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/tickets/${ticketId}/responses`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setResponses(data.responses || []);
      } else {
        toast.error('Ошибка при загрузке ответов');
      }
    } catch (error) {
      logger.error('Error loading responses:', error);
      toast.error('Ошибка при загрузке ответов');
    }
  };

  const handleTicketClick = (ticket) => {
    setSelectedTicket(ticket);
    loadTicketResponses(ticket.id);
    setIsDialogOpen(true);
  };

  const handleSendResponse = async () => {
    if (!newResponse.trim() || !selectedTicket) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('message', newResponse);

      const response = await fetch(`${API_BASE_URL}/api/support/tickets/${selectedTicket.id}/respond`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        toast.success('Ответ отправлен');
        setNewResponse('');
        loadTicketResponses(selectedTicket.id);
        loadTickets(); // Обновляем список тикетов
      } else {
        toast.error('Ошибка при отправке ответа');
      }
    } catch (error) {
      logger.error('Error sending response:', error);
      toast.error('Ошибка при отправке ответа');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    
    if (!createFormData.subject.trim() || !createFormData.message.trim()) {
      toast.error('Заполните все поля');
      return;
    }

    setIsCreating(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('subject', createFormData.subject);
      formDataToSend.append('message', createFormData.message);

      const response = await fetch(`${API_BASE_URL}/api/support/tickets`, {
        method: 'POST',
        credentials: 'include',
        body: formDataToSend
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Тикет #${result.ticket_id} создан успешно!`);
        setIsCreateDialogOpen(false);
        setCreateFormData({ subject: '', message: '' });
        loadTickets(); // Обновляем список тикетов
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Ошибка при создании тикета');
      }
    } catch (error) {
      logger.error('Error creating ticket:', error);
      toast.error('Ошибка при создании тикета');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateInputChange = (field, value) => {
    setCreateFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const getStatusBadge = (status) => {
    const statusConfig = {
      open: { color: 'bg-blue-500', icon: Clock, text: 'Открыт' },
      in_progress: { color: 'bg-yellow-500', icon: AlertCircle, text: 'В работе' },
      closed: { color: 'bg-green-500', icon: CheckCircle, text: 'Закрыт' }
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalUnread = tickets.reduce((sum, ticket) => sum + ticket.unread_responses, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold mb-6 text-foreground">Мои тикеты</h1>
            <p className="text-muted-foreground">
              Ваши обращения в службу поддержки
              {totalUnread > 0 && (
                <span className="ml-2 text-primary font-semibold">
                  ({totalUnread} непрочитанных)
                </span>
              )}
            </p>
          </div>
        </div>
        
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Создать тикет
        </Button>
      </div>

      {/* Список тикетов */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Загрузка тикетов...</p>
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Тикеты не найдены</h3>
              <p className="text-muted-foreground">
                У вас пока нет тикетов поддержки. Создайте тикет, нажав кнопку в правом нижнем углу.
              </p>
            </CardContent>
          </Card>
        ) : (
          tickets.map((ticket) => (
            <Card 
              key={ticket.id} 
              className={`hover:shadow-md transition-shadow cursor-pointer ${
                ticket.unread_responses > 0 ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => handleTicketClick(ticket)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">#{ticket.id} {ticket.subject}</h3>
                      {getStatusBadge(ticket.status)}
                      {ticket.unread_responses > 0 && (
                        <Badge variant="destructive">
                          {ticket.unread_responses} новых
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-3">
                      <p><strong>Создан:</strong> {formatDate(ticket.created_at)}</p>
                      <p><strong>Обновлен:</strong> {formatDate(ticket.updated_at)}</p>
                    </div>

                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap line-clamp-3">{ticket.message}</p>
                    </div>
                  </div>

                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    Открыть
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Диалог просмотра тикета */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Тикет #{selectedTicket?.id}
            </DialogTitle>
            <DialogDescription>
              {selectedTicket?.subject}
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              {/* Информация о тикете */}
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(selectedTicket.status)}
                  <span className="text-sm text-muted-foreground">
                    Создан: {formatDate(selectedTicket.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
              </div>

              {/* Ответы */}
              <div className="space-y-3">
                <h4 className="font-semibold">Переписка:</h4>
                {responses.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Пока нет ответов</p>
                ) : (
                  responses.map((response) => (
                    <div
                      key={response.id}
                      className={`p-3 rounded-lg ${
                        response.is_admin_response
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-green-50 border border-green-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {response.is_admin_response ? '👨‍💼 Администрация' : '👤 Вы'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(response.created_at)}
                          </span>
                        </div>
                        {response.is_admin_response && !response.is_read && (
                          <Badge variant="destructive" className="text-xs">
                            Новое
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{response.message}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Форма ответа */}
              {selectedTicket.status !== 'closed' && (
                <div className="space-y-3">
                  <h4 className="font-semibold">Ответить:</h4>
                  <Textarea
                    placeholder="Введите ваш ответ..."
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
                          Отправка...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Отправить
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {selectedTicket.status === 'closed' && (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>Этот тикет закрыт. Создайте новый тикет для дополнительных вопросов.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Диалог создания тикета */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Написать тикет
            </DialogTitle>
            <DialogDescription>
              Опишите проблему или вопрос. Мы ответим в этом же разделе.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-subject">Тема *</Label>
              <Input
                id="create-subject"
                placeholder="Краткое описание проблемы"
                value={createFormData.subject}
                onChange={(e) => handleCreateInputChange('subject', e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-message">Сообщение *</Label>
              <Textarea
                id="create-message"
                placeholder="Подробно опишите проблему, как её воспроизвести и с чем нужна помощь..."
                value={createFormData.message}
                onChange={(e) => handleCreateInputChange('message', e.target.value)}
                maxLength={500}
                rows={6}
                required
              />
              <div className="text-sm text-muted-foreground text-right">
                {createFormData.message.length}/500 символов
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="min-w-[100px]"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Отправка...
                  </>
                ) : (
                  'Отправить'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InboxPage;
