# Product Overview

TTS_TTV is a Text-to-Speech bot platform for streamers supporting Twitch and VK Live.

## TTS System
- Google Cloud TTS (облачный синтез)
- F5-TTS Advanced (GPU, централизованный для нескольких пользователей)
- F5-TTS Simple (GPU, персональный для одного пользователя)
- Персональные настройки голоса для каждого пользователя
- Блокировка пользователей от TTS
- Режимы прослушивания: website / OBS widget
- Channel Points режим для TTS

## Platform Integrations
- Twitch: OAuth, чат, команды, бейджи, роли, predictions, polls
- VK Live: OAuth, чат, команды, баллы канала, WebSocket
- DonationAlerts: OAuth, автоматические события при донатах
- YouTube: очередь видео, плеер, настройки

## Drops System
- Lootbox с настраиваемыми наградами и вероятностями
- Streak система (привязана к стримам, не дням)
- Donation drops (награды за донаты)
- Мифический сундук (доступен только во время стрима)
- Платформо-специфичные стрики (отдельно Twitch/VK)
- Виджет для OBS с анимациями

## Bot Commands
- Глобальные команды (для всех пользователей)
- Override команды (переопределение глобальных)
- Custom команды (пользовательские)
- Permission система на основе ролей платформы
- Теги команд для организации

## Channel Points
- Twitch Channel Points rewards
- VK Live баллы канала
- Создание/редактирование/удаление наград
- Управление запросами наград

## OBS Widgets
- Chat overlay с кастомизацией
- TTS player widget
- YouTube player widget
- Drops widget с анимациями
- Настройки анимаций и стилей

## Admin Panel
- Управление пользователями
- Управление голосами (глобальные/пользовательские)
- Whitelist/Blacklist каналов
- Системные логи
- Bot token management
- Database health monitoring

## Security
- Role-based access control (Admin/User/Guest)
- Rate limiting (slowapi)
- Input sanitization (XSS/SQLi защита)
- CSRF protection
- Token encryption (Fernet)
- Auth type system (Full/Basic авторизация)

## Performance
- Code splitting и lazy loading
- WebSocket с Leader Election (одно соединение на браузер)
- React Query кэширование
- Virtualization для длинных списков
- Optimistic updates

## Deployment Modes
- Advanced: Centralized F5-TTS для нескольких пользователей (GPU)
- Simple: Personal F5-TTS для одного пользователя (GPU)
- Cloud: Google TTS only (без GPU)
