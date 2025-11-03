// frontend/src/tests/components/LoginPage.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage';
import { AuthProvider } from '../../context/AuthContext';

// Мокаем useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Мокаем AuthContext
jest.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    login: jest.fn(),
    logout: jest.fn(),
    refreshAuthStatus: jest.fn(),
  }),
}));

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login page correctly', () => {
    renderWithProviders(<LoginPage />);
    
    expect(screen.getByText('Войти через Twitch')).toBeInTheDocument();
    expect(screen.getByText('Войти через VK')).toBeInTheDocument();
    expect(screen.getByText('Гостевой режим')).toBeInTheDocument();
  });

  test('handles Twitch login click', () => {
    renderWithProviders(<LoginPage />);
    
    const twitchButton = screen.getByText('Войти через Twitch');
    fireEvent.click(twitchButton);
    
    // Проверяем, что произошел редирект на Twitch OAuth
    expect(window.location.href).toContain('/auth/twitch');
  });

  test('handles VK login click', () => {
    renderWithProviders(<LoginPage />);
    
    const vkButton = screen.getByText('Войти через VK');
    fireEvent.click(vkButton);
    
    // Проверяем, что произошел редирект на VK OAuth
    expect(window.location.href).toContain('/auth/vk');
  });

  test('handles guest mode click', () => {
    renderWithProviders(<LoginPage />);
    
    const guestButton = screen.getByText('Гостевой режим');
    fireEvent.click(guestButton);
    
    // Проверяем, что открылся диалог гостевого режима
    expect(screen.getByText('Гостевой режим')).toBeInTheDocument();
  });

  test('shows verification dialog when guest mode is confirmed', async () => {
    renderWithProviders(<LoginPage />);
    
    const guestButton = screen.getByText('Гостевой режим');
    fireEvent.click(guestButton);
    
    // Находим кнопку подтверждения в диалоге
    const confirmButton = screen.getByText('Продолжить');
    fireEvent.click(confirmButton);
    
    // Проверяем, что открылся диалог верификации
    await waitFor(() => {
      expect(screen.getByText('Верификация гостевого режима')).toBeInTheDocument();
    });
  });

  test('handles guest mode verification', async () => {
    renderWithProviders(<LoginPage />);
    
    const guestButton = screen.getByText('Гостевой режим');
    fireEvent.click(guestButton);
    
    const confirmButton = screen.getByText('Продолжить');
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      const verifyButton = screen.getByText('Верифицировать');
      fireEvent.click(verifyButton);
    });
    
    // Проверяем, что произошел переход в гостевой режим
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('handles dialog close', () => {
    renderWithProviders(<LoginPage />);
    
    const guestButton = screen.getByText('Гостевой режим');
    fireEvent.click(guestButton);
    
    // Находим кнопку закрытия диалога
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    // Проверяем, что диалог закрылся
    expect(screen.queryByText('Гостевой режим')).not.toBeInTheDocument();
  });
});
