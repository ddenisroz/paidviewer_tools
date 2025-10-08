#!/bin/bash
# Скрипт настройки автоматизации обслуживания bot_service

SERVICE_NAME="bot_service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
PYTHON_SCRIPT="$SCRIPT_DIR/maintenance.py"

echo "Настройка автоматизации для $SERVICE_NAME"
echo "Базовая директория: $BASE_DIR"
echo "Скрипты: $SCRIPT_DIR"

# Проверяем, что скрипты существуют
if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo "Ошибка: Скрипт $PYTHON_SCRIPT не найден!"
    exit 1
fi

# Делаем скрипты исполняемыми
chmod +x "$SCRIPT_DIR"/*.py

echo "Создание cron задач..."

# Создаем временный файл с cron задачами
CRON_FILE="/tmp/bot_service_cron"
cat > "$CRON_FILE" << EOF
# Bot Service Maintenance
# Ежедневная очистка в 2:00
0 2 * * * cd $BASE_DIR && python3 $PYTHON_SCRIPT daily >> logs/maintenance.log 2>&1

# Еженедельное обслуживание в воскресенье в 3:00
0 3 * * 0 cd $BASE_DIR && python3 $PYTHON_SCRIPT weekly >> logs/maintenance.log 2>&1

# Проверка статуса каждый час (только предупреждения)
0 * * * * cd $BASE_DIR && python3 $PYTHON_SCRIPT status --alert-only >> logs/maintenance.log 2>&1
EOF

echo "Cron задачи:"
cat "$CRON_FILE"
echo ""

# Предлагаем добавить в crontab
read -p "Добавить эти задачи в crontab? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Добавляем в crontab
    (crontab -l 2>/dev/null; cat "$CRON_FILE") | crontab -
    echo "Cron задачи добавлены!"
else
    echo "Cron задачи НЕ добавлены. Добавьте их вручную:"
    echo "crontab -e"
    echo "Затем скопируйте содержимое из $CRON_FILE"
fi

# Создаем systemd сервис для мониторинга
echo ""
echo "Создание systemd сервиса для мониторинга..."

SERVICE_FILE="/etc/systemd/system/bot-service-monitor.service"
sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Bot Service Disk Monitor
After=network.target

[Service]
Type=oneshot
User=root
WorkingDirectory=$BASE_DIR
ExecStart=/usr/bin/python3 $PYTHON_SCRIPT status --alert-only
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Создаем systemd таймер
TIMER_FILE="/etc/systemd/system/bot-service-monitor.timer"
sudo tee "$TIMER_FILE" > /dev/null << EOF
[Unit]
Description=Bot Service Disk Monitor Timer
Requires=bot-service-monitor.service

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo "Systemd сервис создан: $SERVICE_FILE"
echo "Systemd таймер создан: $TIMER_FILE"

# Перезагружаем systemd
sudo systemctl daemon-reload

# Предлагаем включить таймер
read -p "Включить systemd таймер для мониторинга? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo systemctl enable bot-service-monitor.timer
    sudo systemctl start bot-service-monitor.timer
    echo "Systemd таймер включен и запущен!"
else
    echo "Systemd таймер НЕ включен. Включите вручную:"
    echo "sudo systemctl enable bot-service-monitor.timer"
    echo "sudo systemctl start bot-service-monitor.timer"
fi

# Создаем скрипт для ручного запуска
MANUAL_SCRIPT="$BASE_DIR/run_maintenance.sh"
cat > "$MANUAL_SCRIPT" << EOF
#!/bin/bash
# Ручной запуск обслуживания bot_service

cd "$BASE_DIR"

case "\$1" in
    "daily")
        python3 $PYTHON_SCRIPT daily
        ;;
    "weekly")
        python3 $PYTHON_SCRIPT weekly
        ;;
    "emergency")
        python3 $PYTHON_SCRIPT emergency
        ;;
    "status")
        python3 $PYTHON_SCRIPT status
        ;;
    *)
        echo "Использование: \$0 {daily|weekly|emergency|status}"
        echo ""
        echo "  daily    - Ежедневное обслуживание"
        echo "  weekly   - Еженедельное обслуживание"
        echo "  emergency - Экстренная очистка"
        echo "  status   - Проверка статуса"
        exit 1
        ;;
esac
EOF

chmod +x "$MANUAL_SCRIPT"
echo ""
echo "Создан скрипт для ручного запуска: $MANUAL_SCRIPT"
echo "Использование: $MANUAL_SCRIPT {daily|weekly|emergency|status}"

# Создаем конфигурационный файл
CONFIG_FILE="$BASE_DIR/maintenance.conf"
cat > "$CONFIG_FILE" << EOF
# Конфигурация обслуживания bot_service

# Пороги предупреждений (проценты)
DISK_WARNING_THRESHOLD=80
DISK_CRITICAL_THRESHOLD=90

# Максимальный размер сервиса (в GB)
SERVICE_MAX_SIZE_GB=3

# Возраст файлов для очистки (в днях)
MAX_BACKUP_AGE_DAYS=30
MAX_LOG_AGE_DAYS=90

# Настройки бэкапов
BACKUP_TYPES=database,config
BACKUP_COMPRESS=true

# Настройки логирования
LOG_LEVEL=INFO
EOF

echo "Создан конфигурационный файл: $CONFIG_FILE"

# Очищаем временные файлы
rm -f "$CRON_FILE"

echo ""
echo "Настройка автоматизации завершена!"
echo ""
echo "Полезные команды:"
echo "  $MANUAL_SCRIPT status     - Проверить статус"
echo "  $MANUAL_SCRIPT daily      - Ежедневное обслуживание"
echo "  $MANUAL_SCRIPT weekly     - Еженедельное обслуживание"
echo "  $MANUAL_SCRIPT emergency  - Экстренная очистка"
echo ""
echo "Логи обслуживания: $BASE_DIR/logs/maintenance.log"
echo "Конфигурация: $CONFIG_FILE"
