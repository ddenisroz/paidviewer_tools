// frontend/src/tests/components/ChatCard.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ChatCard from '../../components/ChatCard';
import { AuthProvider } from '../../context/AuthContext';
import { ChatProvider } from '../../context/ChatContext';

// Мокаем WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

global.WebSocket = jest.fn(() => mockWebSocket);

// Мокаем контексты
jest.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 1, is_admin: true },
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

jest.mock('../../context/ChatContext', () => ({
  ChatProvider: ({ children }) => children,
  useChat: () => ({
    messages: [
      {
        id: 1,
        author: 'testuser',
        content: 'Hello, world!',
        platform: 'twitch',
        timestamp: Date.now(),
      },
    ],
    sendMessage: jest.fn(),
    clearMessages: jest.fn(),
  }),
}));

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <ChatProvider>
          {component}
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('ChatCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders chat card correctly', () => {
    renderWithProviders(<ChatCard />);
    
    expect(screen.getByText('Чат')).toBeInTheDocument();
    expect(screen.getByText('OBS Widget')).toBeInTheDocument();
    expect(screen.getByText('Отдельное окно')).toBeInTheDocument();
  });

  test('displays chat messages', () => {
    renderWithProviders(<ChatCard />);
    
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  test('handles message sending', async () => {
    const mockSendMessage = jest.fn();
    
    jest.doMock('../../context/ChatContext', () => ({
      ChatProvider: ({ children }) => children,
      useChat: () => ({
        messages: [],
        sendMessage: mockSendMessage,
        clearMessages: jest.fn(),
      }),
    }));
    
    renderWithProviders(<ChatCard />);
    
    const messageInput = screen.getByPlaceholderText('Введите сообщение...');
    const sendButton = screen.getByText('Отправить');
    
    fireEvent.change(messageInput, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);
    
    expect(mockSendMessage).toHaveBeenCalledWith('Test message');
  });

  test('handles clear messages', () => {
    const mockClearMessages = jest.fn();
    
    jest.doMock('../../context/ChatContext', () => ({
      ChatProvider: ({ children }) => children,
      useChat: () => ({
        messages: [],
        sendMessage: jest.fn(),
        clearMessages: mockClearMessages,
      }),
    }));
    
    renderWithProviders(<ChatCard />);
    
    const clearButton = screen.getByText('Очистить');
    fireEvent.click(clearButton);
    
    expect(mockClearMessages).toHaveBeenCalled();
  });

  test('handles OBS widget toggle', () => {
    renderWithProviders(<ChatCard />);
    
    const obsToggle = screen.getByText('OBS Widget');
    fireEvent.click(obsToggle);
    
    // Проверяем, что открылся диалог OBS настроек
    expect(screen.getByText('Настройки OBS Widget')).toBeInTheDocument();
  });

  test('handles separate window toggle', () => {
    renderWithProviders(<ChatCard />);
    
    const separateWindowToggle = screen.getByText('Отдельное окно');
    fireEvent.click(separateWindowToggle);
    
    // Проверяем, что открылось отдельное окно
    expect(window.open).toHaveBeenCalled();
  });

  test('handles moderation actions', () => {
    renderWithProviders(<ChatCard />);
    
    // Находим сообщение и кнопку модерации
    const message = screen.getByText('Hello, world!');
    const moderationButton = screen.getByRole('button', { name: /moderate/i });
    
    fireEvent.click(moderationButton);
    
    // Проверяем, что открылось меню модерации
    expect(screen.getByText('Заблокировать TTS')).toBeInTheDocument();
    expect(screen.getByText('Таймаут')).toBeInTheDocument();
    expect(screen.getByText('Бан')).toBeInTheDocument();
  });

  test('handles TTS block', async () => {
    renderWithProviders(<ChatCard />);
    
    const moderationButton = screen.getByRole('button', { name: /moderate/i });
    fireEvent.click(moderationButton);
    
    const blockTtsButton = screen.getByText('Заблокировать TTS');
    fireEvent.click(blockTtsButton);
    
    // Проверяем, что открылся диалог блокировки TTS
    await waitFor(() => {
      expect(screen.getByText('Заблокировать пользователя от TTS')).toBeInTheDocument();
    });
  });

  test('handles timeout', async () => {
    renderWithProviders(<ChatCard />);
    
    const moderationButton = screen.getByRole('button', { name: /moderate/i });
    fireEvent.click(moderationButton);
    
    const timeoutButton = screen.getByText('Таймаут');
    fireEvent.click(timeoutButton);
    
    // Проверяем, что открылся диалог таймаута
    await waitFor(() => {
      expect(screen.getByText('Таймаут пользователя')).toBeInTheDocument();
    });
  });

  test('handles ban', async () => {
    renderWithProviders(<ChatCard />);
    
    const moderationButton = screen.getByRole('button', { name: /moderate/i });
    fireEvent.click(moderationButton);
    
    const banButton = screen.getByText('Бан');
    fireEvent.click(banButton);
    
    // Проверяем, что открылся диалог бана
    await waitFor(() => {
      expect(screen.getByText('Забанить пользователя')).toBeInTheDocument();
    });
  });

  test('handles role management', async () => {
    renderWithProviders(<ChatCard />);
    
    const moderationButton = screen.getByRole('button', { name: /moderate/i });
    fireEvent.click(moderationButton);
    
    const roleButton = screen.getByText('Роли');
    fireEvent.click(roleButton);
    
    // Проверяем, что открылся диалог управления ролями
    await waitFor(() => {
      expect(screen.getByText('Управление ролями')).toBeInTheDocument();
    });
  });
});
