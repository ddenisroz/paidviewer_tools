# Система типов авторизации (Auth Type)

**Дата создания:** 15 декабря 2025  
**Версия:** 1.0  
**Статус:** Production Ready

---

## Обзор

Система типов авторизации позволяет пользователям выбирать между полной и упрощенной авторизацией при входе через Twitch или VK Live.

### Типы авторизации

| Тип | Описание | Доступные функции |
|-----|----------|-------------------|
| `full` | Полная авторизация | Все функции: TTS, YouTube, Drops, управление стримом, channel points |
| `basic` | Упрощенная авторизация | Базовые функции: TTS, YouTube, Drops (без управления стримом) |

---

## Архитектура

### Backend

#### Константы (`bot_service/constants.py`)

```python
class AuthType:
    FULL = "full"    # Полная авторизация
    BASIC = "basic"  # Упрощенная авторизация

# Scopes для полной авторизации
OAUTH_SCOPES_FULL = {
    "twitch": "user:read:email channel:read:stream_key channel:manage:broadcast channel:manage:redemptions",
    "vk": "channel:stream:settings,channel:points:rewards,channel:points:rewards:demands"
}

# Scopes для упрощенной авторизации
OAUTH_SCOPES_BASIC = {
    "twitch": "user:read:email",
    "vk": ""  # Пустой scope - только базовая информация
}
```

#### Модель UserToken (`bot_service/core/database.py`)

```python
class UserToken(Base):
    __tablename__ = 'user_tokens'
    
    # ... другие поля ...
    auth_type = Column(String, nullable=False, default='full', index=True)
```

#### API (`bot_service/api/auth_type_api.py`)

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/auth/type` | GET | Получить типы авторизации для всех платформ |
| `/api/auth/type/{platform}` | GET | Получить тип авторизации для платформы |
| `/api/auth/upgrade/{platform}` | POST | Инициировать апгрейд с basic на full |

#### OAuth Handler (`bot_service/auth/oauth_handler.py`)

Метод `handle_oauth_callback` принимает параметр `auth_type` и сохраняет его в токене:

```python
async def handle_oauth_callback(
    self,
    request: Request,
    db: Session,
    platform: str,
    user_data: OAuthUserData,
    current_user: Optional[Dict] = None,
    auto_connect_bot: bool = True,
    auth_type: str = "full"  # Тип авторизации
) -> OAuthResult:
```

### Frontend

#### Страница логина (`frontend/src/pages/LoginPage.tsx`)

Двухшаговый процесс:
1. Выбор платформы (Twitch / VK Live)
2. Выбор типа авторизации (Полная / Упрощенная)

#### Хук useAuthType (`frontend/src/hooks/useAuthType.ts`)

```typescript
// Получить типы авторизации для всех платформ
const { data } = useAuthTypes();

// Получить тип для конкретной платформы
const { authType, isBasicAuth, canUpgrade } = useAuthType('twitch');

// Проверить нужен ли апгрейд
const { requiresUpgrade } = useRequiresFullAuth('twitch');
```

#### Баннер BasicAuthBanner (`frontend/src/components/BasicAuthBanner.tsx`)

Компонент для отображения заблокированных функций:

```tsx
<BasicAuthBanner
    featureName="Управление стримом"
    platform="twitch"
    description="Требуется полная авторизация"
/>
```

---

## Миграция базы данных

Миграция `20251215_add_auth_type_to_user_tokens.py`:

```python
def upgrade():
    op.add_column(
        'user_tokens',
        sa.Column('auth_type', sa.String(), nullable=False, server_default='full')
    )
    op.create_index('ix_user_tokens_auth_type', 'user_tokens', ['auth_type'])

def downgrade():
    op.drop_index('ix_user_tokens_auth_type', table_name='user_tokens')
    op.drop_column('user_tokens', 'auth_type')
```

---

## Использование

### Для пользователей

1. На странице логина выбрать платформу
2. Выбрать тип авторизации:
   - **Полная** - все функции доступны
   - **Упрощенная** - базовые функции без управления стримом

### Для разработчиков

#### Проверка типа авторизации в компоненте

```tsx
import { useAuthType } from '@/hooks/useAuthType';
import BasicAuthBanner from '@/components/BasicAuthBanner';

const StreamSettings = () => {
    const { isBasicAuth } = useAuthType('twitch');
    
    if (isBasicAuth) {
        return (
            <BasicAuthBanner
                featureName="Настройки стрима"
                platform="twitch"
            />
        );
    }
    
    return <StreamSettingsForm />;
};
```

#### Проверка на backend

```python
from core.database import UserToken

def check_full_auth(user_id: int, platform: str, db: Session) -> bool:
    token = db.query(UserToken).filter(
        UserToken.user_id == user_id,
        UserToken.platform == platform,
        UserToken.is_active == True
    ).first()
    
    return token and token.auth_type == 'full'
```

---

## Функции по типам авторизации

### Доступно при basic авторизации

- TTS озвучка сообщений
- YouTube заказы
- Drops система (стрики, награды)
- Просмотр чата
- Базовые настройки

### Требует full авторизации

- Управление названием стрима
- Управление категорией стрима
- Channel Points (создание наград)
- Расширенные настройки платформы

---

## Тестирование

Тесты находятся в `bot_service/tests/test_auth_type.py`:

```bash
cd bot_service
pytest tests/test_auth_type.py -v
```

---

## Безопасность

- Тип авторизации сохраняется в зашифрованном токене
- При апгрейде требуется повторная OAuth авторизация
- Scopes проверяются на стороне платформы (Twitch/VK)
- Backend валидирует права перед выполнением операций

---

## Связанные файлы

### Backend
- `bot_service/constants.py` - константы AuthType, OAUTH_SCOPES
- `bot_service/core/database.py` - модель UserToken
- `bot_service/auth/oauth_handler.py` - обработка OAuth
- `bot_service/auth/twitch_auth.py` - Twitch OAuth
- `bot_service/auth/vk_auth.py` - VK OAuth
- `bot_service/api/auth_type_api.py` - API endpoints
- `bot_service/core/session_manager.py` - сохранение токенов

### Frontend
- `frontend/src/pages/LoginPage.tsx` - страница логина
- `frontend/src/components/BasicAuthBanner.tsx` - баннер ограничений
- `frontend/src/hooks/useAuthType.ts` - хук для работы с auth_type

### Миграции
- `bot_service/alembic/versions/20251215_add_auth_type_to_user_tokens.py`

### Тесты
- `bot_service/tests/test_auth_type.py`
