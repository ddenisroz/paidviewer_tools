#!/bin/bash

# Скрипт настройки Cloudflare Tunnel для TTS Service

echo "🌐 Настройка Cloudflare Tunnel для TTS Service..."

# Проверяем установку cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "📥 Устанавливаем cloudflared..."
    
    # Для Windows (в WSL или Git Bash)
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        echo "Скачайте cloudflared для Windows с:"
        echo "https://github.com/cloudflare/cloudflared/releases"
        exit 1
    fi
    
    # Для Linux
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared-linux-amd64.deb
    rm cloudflared-linux-amd64.deb
fi

echo "🔐 Авторизация в Cloudflare..."
echo "Выполните команду: cloudflared tunnel login"
echo "Затем выберите ваш домен в браузере"

read -p "Нажмите Enter после завершения авторизации..."

# Создаем туннель
TUNNEL_NAME="tts-service-$(date +%s)"
echo "🚇 Создаем туннель: $TUNNEL_NAME"
cloudflared tunnel create $TUNNEL_NAME

# Получаем UUID туннеля
TUNNEL_UUID=$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}')
echo "🆔 UUID туннеля: $TUNNEL_UUID"

# Создаем конфигурацию
cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_UUID
credentials-file: ~/.cloudflared/$TUNNEL_UUID.json

ingress:
  - hostname: tts.yourdomain.com
    service: http://localhost:8002
  - service: http_status:404
EOF

echo "⚙️  Конфигурация создана в ~/.cloudflared/config.yml"
echo "📝 Не забудьте:"
echo "   1. Заменить 'yourdomain.com' на ваш домен"
echo "   2. Настроить DNS запись: tts.yourdomain.com CNAME $TUNNEL_UUID.cfargotunnel.com"
echo "   3. Запустить туннель: cloudflared tunnel run $TUNNEL_NAME"

# Создаем systemd сервис для автозапуска (Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🔄 Создаем systemd сервис..."
    sudo tee /etc/systemd/system/cloudflared.service > /dev/null << EOF
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel run $TUNNEL_NAME
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl enable cloudflared
    echo "✅ Systemd сервис создан и включен"
    echo "Запуск: sudo systemctl start cloudflared"
    echo "Статус: sudo systemctl status cloudflared"
fi

echo "🎉 Настройка Cloudflare Tunnel завершена!"
