#  Security v2.0.0

**Версия:** 2.0.0 | **Дата:** 20 октября 2025

##  Главные компоненты

-  JWT токены
-  OAuth 2.0 (Twitch + VK Live)
-  Шифрование токенов в БД
-  CORS configured
-  Rate limiting (3 req/sec)
-  Pydantic валидация
-  Проверка прав доступа
-  HTTPS в продакшене

##  Авторизация

\\\python
# Используйте get_current_user dependency
@router.get("/")
async def endpoint(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.get('id')
    # ...
\\\

##  НЕ ДЕЛАЙТЕ

-  Не логируйте токены
-  Не сохраняйте пароли в открытом виде
-  Не пропускайте валидацию
-  Не доверяйте клиентским данным

##  ДЕЛАЙТЕ

-  Валидируйте всё
-  Логируйте ошибки доступа
-  Используйте HTTPS
-  Обновляйте зависимости

---

**Версия:** 2.0.0 | **Статус:** Актуально
