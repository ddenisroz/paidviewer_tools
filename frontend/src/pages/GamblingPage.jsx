import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Gift, Play, Pause, RotateCcw, Plus, Minus, Users, Clock, Trophy, Dice6 } from 'lucide-react';
import LootboxSystem from '../components/LootboxSystem';
import { useAuth } from '../context/AuthContext';

const GamblingPage = () => {
  const { user } = useAuth();
  const [donationAlertsConnected, setDonationAlertsConnected] = useState(false);
  const [showDonations, setShowDonations] = useState(false);
  const [timer, setTimer] = useState(300); // 5 минут по умолчанию
  const [timerRunning, setTimerRunning] = useState(false);
  const [currentTimer, setCurrentTimer] = useState(300);
  const [donations, setDonations] = useState([
    // Моковые донаты для демонстрации
    { id: 1, username: 'Player1', message: 'За команду Драконов!', amount: 500 },
    { id: 2, username: 'Player2', message: 'Рыцари победят!', amount: 300 },
    { id: 3, username: 'Player3', message: 'Магия сильнее всего', amount: 750 },
    { id: 4, username: 'Player4', message: 'Воины вперед!', amount: 200 },
  ]);
  const [teams, setTeams] = useState([]);
  const [gamePhase, setGamePhase] = useState('setup'); // setup, collecting, battle, finished
  const [battleLog, setBattleLog] = useState([]);
  const [survivors, setSurvivors] = useState([]);
  const [draggedDonation, setDraggedDonation] = useState(null);

  // Проверка статуса DonationAlerts
  const checkDonationAlertsStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/donationalerts/status`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log('DonationAlerts status check failed:', response.status);
        setDonationAlertsConnected(false);
        return;
      }
      
      const data = await response.json();
      setDonationAlertsConnected(data.connected);
    } catch (error) {
      console.error('Error checking DonationAlerts status:', error);
      setDonationAlertsConnected(false);
    }
  };

  // Загрузка донатов
  const loadRecentDonations = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/donationalerts/donations`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.donations) {
        setDonations(data.donations);
      }
    } catch (error) {
      console.error('Error loading donations:', error);
    }
  };

  // Подключение к DonationAlerts
  const connectDonationAlerts = async () => {
    try {
      console.log('Connecting to DonationAlerts...');
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/donationalerts/connect`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        return;
      }

      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.auth_url) {
        window.open(data.auth_url, '_blank');
      }
    } catch (error) {
      console.error('Error connecting DonationAlerts:', error);
    }
  };

  useEffect(() => {
    // Проверяем авторизацию через API
    checkDonationAlertsStatus();
    
    checkDonationAlertsStatus();
  }, []);

  // Управление таймером
  const startTimer = () => {
    setTimerRunning(true);
    setGamePhase('collecting');
  };

  const pauseTimer = () => {
    setTimerRunning(false);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setCurrentTimer(timer);
    setGamePhase('setup');
    setTeams([]);
    setBattleLog([]);
    setSurvivors([]);
  };

  const addMinutes = () => {
    setTimer(prev => prev + 60);
    if (!timerRunning) {
      setCurrentTimer(prev => prev + 60);
    }
  };

  const subtractMinutes = () => {
    if (timer > 60) {
      setTimer(prev => prev - 60);
      if (!timerRunning) {
        setCurrentTimer(prev => Math.max(60, prev - 60));
      }
    }
  };

  // Таймер countdown
  useEffect(() => {
    let interval = null;
    if (timerRunning && currentTimer > 0) {
      interval = setInterval(() => {
        setCurrentTimer(time => {
          if (time <= 1) {
            setTimerRunning(false);
            setGamePhase('battle');
            startBattle();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    } else if (!timerRunning && currentTimer !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerRunning, currentTimer]);

  // Создание команды
  const createTeam = () => {
    const newTeam = {
      id: Date.now(),
      name: `Команда ${teams.length + 1}`,
      donations: [],
      characters: []
    };
    setTeams([...teams, newTeam]);
  };

  // Drag & Drop функции
  const handleDragStart = (donation) => {
    setDraggedDonation(donation);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, teamId) => {
    e.preventDefault();
    if (!draggedDonation) return;

    const team = teams.find(t => t.id === teamId);
    if (team) {
      // Удаляем донат из общего списка
      setDonations(prev => prev.filter(d => d.id !== draggedDonation.id));
      
      // Добавляем донат в команду
      const updatedTeams = teams.map(t => 
        t.id === teamId 
          ? { ...t, donations: [...t.donations, draggedDonation] }
          : t
      );
      setTeams(updatedTeams);
    }
    setDraggedDonation(null);
  };

  // Генерация персонажей на основе донатов
  const generateCharacters = (teamDonations) => {
    return teamDonations.map((donation, index) => {
      const type = getCharacterType(donation.amount);
      return {
        id: `${donation.id}-char`,
        name: donation.username,
        type,
        power: Math.floor(donation.amount / 100),
        sprite: getCharacterSprite(type),
        donation: donation
      };
    });
  };

  const getCharacterType = (amount) => {
    if (amount >= 1000) return 'Dragon';
    if (amount >= 500) return 'Knight';
    if (amount >= 300) return 'Mage';
    return 'Warrior';
  };

  const getCharacterSprite = (type) => {
    const sprites = {
      'Warrior': '⚔️',
      'Mage': '🧙',
      'Knight': '🛡️',
      'Dragon': '🐉'
    };
    return sprites[type] || '⚔️';
  };

  // Боевая система
  const startBattle = () => {
    const allTeams = teams.map(team => ({
      ...team,
      characters: generateCharacters(team.donations)
    }));
    setTeams(allTeams);
    simulateBattle(allTeams);
  };

  const simulateBattle = (battleTeams) => {
    const log = [];
    let remainingTeams = battleTeams.filter(team => team.characters.length > 0);
    
    log.push('🎬 Начинается эпическая битва!');
    
    // Симуляция раундов
    let round = 1;
    while (remainingTeams.length > 1) {
      log.push(`\n⚔️ Раунд ${round}:`);
      
      // Случайная битва между командами
      const team1 = remainingTeams[0];
      const team2 = remainingTeams[1];
      
      const team1Power = team1.characters.reduce((sum, char) => sum + char.power, 0);
      const team2Power = team2.characters.reduce((sum, char) => sum + char.power, 0);
      
      if (team1Power > team2Power) {
        log.push(`🏆 ${team1.name} побеждает ${team2.name}! (${team1Power} vs ${team2Power})`);
        remainingTeams = remainingTeams.filter(t => t.id !== team2.id);
      } else if (team2Power > team1Power) {
        log.push(`🏆 ${team2.name} побеждает ${team1.name}! (${team2Power} vs ${team1Power})`);
        remainingTeams = remainingTeams.filter(t => t.id !== team1.id);
      } else {
        // Ничья - случайный исход
        const winner = Math.random() > 0.5 ? team1 : team2;
        const loser = winner === team1 ? team2 : team1;
        log.push(`🎲 ${winner.name} побеждает ${loser.name} в ничьей! (${team1Power} vs ${team2Power})`);
        remainingTeams = remainingTeams.filter(t => t.id !== loser.id);
      }
      
      round++;
    }
    
    if (remainingTeams.length === 1) {
      const winner = remainingTeams[0];
      log.push(`\n🏆 ${winner.name} - ПОБЕДИТЕЛЬ!`);
      setSurvivors(winner.characters);
      setGamePhase('finished');
    }
    
    setBattleLog(log);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-6 text-foreground">
            Гэмблинг система
          </h1>
        </div>
      </div>

      <Tabs defaultValue="donation-arena" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="donation-arena" className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Донатная арена
          </TabsTrigger>
          <TabsTrigger value="lootboxes" className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Лутбоксы
          </TabsTrigger>
        </TabsList>

        <TabsContent value="donation-arena" className="space-y-6">

      {/* DonationAlerts подключение */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            DonationAlerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {donationAlertsConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Подключено</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={loadRecentDonations}
                  disabled={!showDonations}
                >
                  Загрузить донаты
                </Button>
                <Button 
                  onClick={() => setShowDonations(!showDonations)}
                >
                  {showDonations ? 'Скрыть' : 'Показать'} донаты
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Подключитесь к DonationAlerts для получения донатов в реальном времени
              </p>
              <Button onClick={connectDonationAlerts}>
                Подключить DonationAlerts
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {donationAlertsConnected ? (
        <div className="space-y-6">
          {/* Таймер */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Таймер сбора
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <div className="text-4xl font-mono font-bold text-foreground">
                  {formatTime(currentTimer)}
                </div>
                <div className="flex justify-center gap-2">
                  <Button 
                    onClick={startTimer} 
                    disabled={timerRunning || gamePhase === 'battle' || gamePhase === 'finished'}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Старт
                  </Button>
                  <Button 
                    onClick={pauseTimer} 
                    disabled={!timerRunning}
                    variant="outline"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Пауза
                  </Button>
                  <Button 
                    onClick={resetTimer} 
                    variant="outline"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Сброс
                  </Button>
                </div>
                <div className="flex justify-center gap-2">
                  <Button 
                    onClick={subtractMinutes} 
                    variant="outline" 
                    size="sm"
                    disabled={timer <= 60}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="px-3 py-1 bg-muted rounded text-sm">
                    {Math.floor(timer / 60)} мин
                  </span>
                  <Button 
                    onClick={addMinutes} 
                    variant="outline" 
                    size="sm"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Донаты */}
          {showDonations && (
            <Card>
              <CardHeader>
                <CardTitle>Входящие донаты</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {donations.map((donation) => (
                    <div
                      key={donation.id}
                      draggable
                      onDragStart={() => handleDragStart(donation)}
                      className="p-4 border rounded-lg cursor-move hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">{donation.username}</span>
                        <span className="text-green-600 font-bold">
                          {donation.amount}₽
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {donation.message}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Таблица команд */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Команды</span>
                <Button onClick={createTeam} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Создать команду
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Создайте команды и перетащите в них донаты</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, team.id)}
                      className="p-4 border rounded-lg min-h-[100px] bg-muted/20"
                    >
                      <h3 className="font-medium mb-2">{team.name}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {team.characters.map((char) => (
                          <div key={char.id} className="text-center p-2 bg-background rounded border">
                            <div className="text-2xl mb-1">{char.sprite}</div>
                            <div className="text-xs font-medium">{char.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {char.type} (⚡{char.power})
                            </div>
                          </div>
                        ))}
                      </div>
                      {team.donations.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm mt-4">
                          Перетащите сюда донаты
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Лог боя */}
          {gamePhase === 'battle' && (
            <Card>
              <CardHeader>
                <CardTitle>Лог битвы</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg max-h-64 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap">{battleLog.join('\n')}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Результаты */}
          {gamePhase === 'finished' && survivors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Результаты битвы
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="text-2xl font-bold text-yellow-600">
                    🏆 АБСОЛЮТНЫЙ ЧЕМПИОН! 🏆
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {survivors.map((char) => (
                      <div key={char.id} className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-2 border-yellow-200 dark:border-yellow-800">
                        <div className="text-4xl mb-2">{char.sprite}</div>
                        <div className="font-bold">{char.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {char.type} (⚡{char.power})
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {char.donation.amount}₽
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Подключитесь к DonationAlerts для начала игры</p>
        </div>
      )}
        </TabsContent>

        <TabsContent value="lootboxes" className="space-y-6">
          <LootboxSystem channelName={user?.username || 'default'} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GamblingPage;
