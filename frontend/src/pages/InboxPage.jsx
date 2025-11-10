import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../constants';
import { MessageCircle, Clock, CheckCircle, AlertCircle, Reply, Send, Eye, EyeOff, Plus, Settings } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';
import { supportService } from '../services/api/services/supportService';
import { getErrorMessage, getOperationMessage } from '../services/microservices';
import { validators, createFormErrors, isFormValid } from '../utils/formValidation';
import { useAuth } from '../context/AuthContext';
import PageWrapper from '../components/PageWrapper';

const InboxPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
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
  const [createFormErrors, setCreateFormErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);

  // ✅ Валидация формы в реальном времени
  const validateCreateForm = (data) => {
    const errors = {};
    
    if (!data.subject.trim()) {
      errors.subject = 'Тема обязательна';
    } else if (data.subject.length < 3) {
      errors.subject = 'Минимум 3 символа';
    } else if (data.subject.length > 100) {
      errors.subject = 'Максимум 100 символов';
    }

    if (!data.message.trim()) {
      errors.message = 'Сообщение обязательно';
    } else if (data.message.length < 10) {
      errors.message = 'Минимум 10 символов';
    } else if (data.message.length > 5000) {
      errors.message = 'Максимум 5000 символов';
    }

    return errors;
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await supportService.getMyTickets();
      setTickets(response.data.tickets || []);
    } catch (error) {
      logger.error('Error loading tickets:', error);
      const errorMsg = error.status === 503 
        ? 'Сервис на обслуживании. Попробуйте позже.'
        : 'Не удалось загрузить тикеты. Проверьте интернет-соединение.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadTicketResponses = async (ticketId) => {
    try {
      const response = await supportService.getTicketResponses(ticketId);
      setResponses(response.data.responses || []);
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

    const messageText = newResponse;
    
    // ✅ OPTIMISTIC UPDATE: Добавляем ответ в UI сразу
    const optimisticResponse = {
      id: Date.now(),
      message: messageText,
      is_admin_response: false,
      is_read: true,
      created_at: new Date().toISOString()
    };
    
    setResponses(prev => [...prev, optimisticResponse]);
    setNewResponse('');
    toast.success('Ответ отправлен');

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('message', messageText);

      const response = await supportService.respondToTicket(selectedTicket.id, formData);
      // ✅ Успешно отправлено - перезагружаем реальные данные
      await loadTicketResponses(selectedTicket.id);
      await loadTickets();
    } catch (error) {
      // ❌ Ошибка сети - откатываем optimistic update
      setResponses(prev => prev.filter(r => r.id !== optimisticResponse.id));
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

    // ✅ OPTIMISTIC UPDATE: Создаем новый тикет в UI сразу
    const optimisticTicket = {
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
    toast.success('Тикет создан');

    setIsCreating(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('subject', createFormData.subject);
      formDataToSend.append('message', createFormData.message);

      const response = await supportService.createTicket(formDataToSend);
      // ✅ Успешно создано - перезагружаем реальные данные
      toast.success(`Тикет #${response.data.ticket_id} успешно создан!`);
      await loadTickets();
    } catch (error) {
      // ❌ Ошибка сети - откатываем optimistic update
      setTickets(prev => prev.filter(t => t.id !== optimisticTicket.id));
      logger.error('Error creating ticket:', error);
      toast.error('Ошибка при создании тикета');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateInputChange = (field, value) => {
    const newData = { ...createFormData, [field]: value };
    setCreateFormData(newData);
    
    // ✅ Real-time validation
    const errors = validateCreateForm(newData);
    setCreateFormErrors(errors);
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

  // 🔒 ПЕРВООЧЕРЕДНАЯ ПРОВЕРКА: Авторизация
  // Если пользователь не авторизован - показываем сообщение с предложением войти
  if (!isAuthenticated) {
    return (
      <PageWrapper title="Входящие">
        <Card className="border-gray-700">
          <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-gray-500" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold text-gray-200">
                Требуется авторизация
              </h3>
              <p className="text-gray-400 text-sm">
                Для доступа к входящим сообщениям необходимо войти в систему
              </p>
            </div>
            <Button 
              onClick={() => navigate('/login')}
              className="gap-2"
            >
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
      <div className="flex items-center justify-between">
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
          <Card className="border-dashed border-2">
            <CardContent className="p-12 text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Нет тикетов поддержки</h3>
              <p className="text-muted-foreground mb-6">
                Все хорошо! 🎉 У вас пока нет обращений в службу поддержки.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Создать первый тикет
              </Button>
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
                      <p className="text-sm whitespace-pre-wrap line-clamp-3 break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{ticket.message}</p>
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
            <DialogTitle>
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
                <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{selectedTicket.message}</p>
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
                            {response.is_admin_response ? 'Администрация' : 'Вы'}
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
                      <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{response.message}</p>
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
            <DialogTitle>
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
                className={createFormErrors.subject ? 'border-red-500' : ''}
              />
              {createFormErrors.subject && (
                <p className="text-red-500 text-sm">{createFormErrors.subject}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-message">Сообщение *</Label>
              <Textarea
                id="create-message"
                placeholder="Подробно опишите проблему, как её воспроизвести и с чем нужна помощь..."
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
                {createFormData.message.length}/5000 символов
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
                disabled={isCreating || Object.keys(createFormErrors).length > 0}
                className="min-w-[100px]"
                title={Object.keys(createFormErrors).length > 0 ? 'Исправьте ошибки перед отправкой' : ''}
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Отправка...
                  </>
                ) : Object.keys(createFormErrors).length > 0 ? (
                  'Исправьте ошибки'
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
