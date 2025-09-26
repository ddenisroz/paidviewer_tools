# bot_service/services/auction_service.py
import logging
import asyncio
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, asc, func
from core.database import Auction, AuctionBid, ChannelPoints, PointsTransaction, get_db
from services.points_service import PointsService
from datetime import datetime, timedelta
import random

logger = logging.getLogger('bot_service')

class AuctionService:
    """
    Сервис для управления интерактивными аукционами за баллы канала
    """
    
    def __init__(self):
        self.points_service = PointsService()
        self.active_auctions = {}  # Кэш активных аукционов для быстрого доступа
    
    # === УПРАВЛЕНИЕ АУКЦИОНАМИ ===
    
    def create_auction(
        self, 
        user_id: int, 
        channel_name: str, 
        title: str, 
        description: str = None, 
        starting_bid: int = 10,
        duration_minutes: int = 5,
        **kwargs
    ) -> Dict[str, Any]:
        """Создание нового аукциона"""
        
        db = next(get_db())
        try:
            auction = Auction(
                user_id=user_id,
                channel_name=channel_name,
                title=title,
                description=description,
                starting_bid=starting_bid,
                current_bid=0,
                bid_increment=kwargs.get('bid_increment', 10),
                duration_minutes=duration_minutes,
                status='pending',
                platforms=kwargs.get('platforms', ['twitch', 'vk']),
                auto_extend=kwargs.get('auto_extend', True),
                min_participants=kwargs.get('min_participants', 2),
                max_bid_limit=kwargs.get('max_bid_limit'),
                image_url=kwargs.get('image_url')
            )
            
            db.add(auction)
            db.commit()
            db.refresh(auction)
            
            logger.info(f"Created auction: {title} with starting bid {starting_bid}")
            
            return {
                'success': True,
                'auction_id': auction.id,
                'auction': self._format_auction(auction)
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating auction: {e}")
            return {'success': False, 'error': 'Ошибка создания аукциона'}
        finally:
            db.close()
    
    def start_auction(self, user_id: int, auction_id: int) -> Dict[str, Any]:
        """Запуск аукциона"""
        
        db = next(get_db())
        try:
            auction = db.query(Auction).filter(
                and_(
                    Auction.id == auction_id,
                    Auction.user_id == user_id,
                    Auction.status == 'pending'
                )
            ).first()
            
            if not auction:
                return {'success': False, 'error': 'Аукцион не найден или уже запущен'}
            
            # Запускаем аукцион
            now = datetime.utcnow()
            auction.status = 'active'
            auction.started_at = now
            auction.ends_at = now + timedelta(minutes=auction.duration_minutes)
            auction.current_bid = auction.starting_bid
            
            db.commit()
            db.refresh(auction)
            
            # Добавляем в кэш активных аукционов
            self.active_auctions[auction_id] = {
                'auction': auction,
                'last_bidder': None,
                'bid_count': 0
            }
            
            logger.info(f"Started auction {auction_id}: {auction.title}")
            
            # Запускаем таймер завершения аукциона
            asyncio.create_task(self._schedule_auction_end(auction_id, auction.duration_minutes))
            
            return {
                'success': True,
                'message': f'Аукцион "{auction.title}" запущен!',
                'auction': self._format_auction(auction)
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error starting auction: {e}")
            return {'success': False, 'error': 'Ошибка запуска аукциона'}
        finally:
            db.close()
    
    async def place_bid(
        self, 
        user_id: int, 
        auction_id: int, 
        bidder_id: str, 
        bidder_name: str, 
        platform: str, 
        channel_name: str, 
        bid_amount: int
    ) -> Dict[str, Any]:
        """Размещение ставки в аукционе"""
        
        db = next(get_db())
        try:
            # Получаем аукцион
            auction = db.query(Auction).filter(
                and_(
                    Auction.id == auction_id,
                    Auction.user_id == user_id,
                    Auction.status == 'active'
                )
            ).first()
            
            if not auction:
                return {'success': False, 'error': 'Аукцион не найден или не активен'}
            
            # Проверяем, что аукцион не завершен
            if datetime.utcnow() > auction.ends_at:
                return {'success': False, 'error': 'Аукцион уже завершен'}
            
            # Проверяем минимальную ставку
            min_bid = auction.current_bid + auction.bid_increment
            if bid_amount < min_bid:
                return {'success': False, 'error': f'Минимальная ставка: {min_bid} баллов'}
            
            # Проверяем максимальную ставку
            if auction.max_bid_limit and bid_amount > auction.max_bid_limit:
                return {'success': False, 'error': f'Максимальная ставка: {auction.max_bid_limit} баллов'}
            
            # Проверяем баллы у участника
            user_points = self.points_service.get_user_points(
                user_id, bidder_id, platform, channel_name, db
            )
            
            if user_points < bid_amount:
                return {
                    'success': False, 
                    'error': f'Недостаточно баллов. У вас: {user_points}, нужно: {bid_amount}'
                }
            
            # Возвращаем баллы предыдущему участнику (если есть)
            if auction.current_bid > 0:
                last_bid = db.query(AuctionBid).filter(
                    AuctionBid.auction_id == auction_id
                ).order_by(desc(AuctionBid.created_at)).first()
                
                if last_bid:
                    self.points_service.add_points(
                        user_id, last_bid.bidder_id, last_bid.bidder_name,
                        last_bid.platform, last_bid.channel_name,
                        last_bid.bid_amount, f"Auction refund: {auction.title}", db
                    )
            
            # Списываем баллы у нового участника
            deduct_result = self.points_service.deduct_points(
                user_id, bidder_id, bidder_name, platform, channel_name,
                bid_amount, f"Auction bid: {auction.title}", db
            )
            
            if not deduct_result['success']:
                return deduct_result
            
            # Обновляем аукцион
            auction.current_bid = bid_amount
            
            # Создаем запись ставки
            bid = AuctionBid(
                auction_id=auction_id,
                user_id=user_id,
                bidder_id=bidder_id,
                bidder_name=bidder_name,
                platform=platform,
                channel_name=channel_name,
                bid_amount=bid_amount
            )
            
            db.add(bid)
            
            # Автопродление (если ставка в последние 30 секунд)
            if auction.auto_extend:
                time_left = (auction.ends_at - datetime.utcnow()).total_seconds()
                if time_left < 30:
                    auction.ends_at = datetime.utcnow() + timedelta(seconds=30)
                    logger.info(f"Auto-extended auction {auction_id} by 30 seconds")
            
            db.commit()
            
            # Обновляем кэш
            if auction_id in self.active_auctions:
                self.active_auctions[auction_id]['last_bidder'] = bidder_name
                self.active_auctions[auction_id]['bid_count'] += 1
            
            logger.info(f"New bid in auction {auction_id}: {bidder_name} - {bid_amount} points")
            
            return {
                'success': True,
                'message': f'Ставка {bid_amount} баллов принята!',
                'auction': self._format_auction(auction),
                'time_left': (auction.ends_at - datetime.utcnow()).total_seconds(),
                'is_leading': True
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error placing bid: {e}")
            return {'success': False, 'error': 'Ошибка размещения ставки'}
        finally:
            db.close()
    
    async def _schedule_auction_end(self, auction_id: int, duration_minutes: int):
        """Планирование автоматического завершения аукциона"""
        try:
            # Ждем указанное время + небольшой буфер для автопродлений
            await asyncio.sleep((duration_minutes * 60) + 60)
            
            # Завершаем аукцион
            await self.end_auction(auction_id)
            
        except Exception as e:
            logger.error(f"Error in auction scheduler: {e}")
    
    async def end_auction(self, auction_id: int) -> Dict[str, Any]:
        """Завершение аукциона"""
        
        db = next(get_db())
        try:
            auction = db.query(Auction).filter(
                and_(
                    Auction.id == auction_id,
                    Auction.status == 'active'
                )
            ).first()
            
            if not auction:
                return {'success': False, 'error': 'Аукцион не найден или уже завершен'}
            
            # Получаем последнюю ставку (победителя)
            winning_bid = db.query(AuctionBid).filter(
                AuctionBid.auction_id == auction_id
            ).order_by(desc(AuctionBid.created_at)).first()
            
            # Проверяем минимальное количество участников
            participant_count = db.query(func.count(func.distinct(AuctionBid.bidder_id))).filter(
                AuctionBid.auction_id == auction_id
            ).scalar() or 0
            
            if participant_count < auction.min_participants:
                # Отменяем аукцион и возвращаем баллы
                auction.status = 'cancelled'
                
                if winning_bid:
                    self.points_service.add_points(
                        auction.user_id, winning_bid.bidder_id, winning_bid.bidder_name,
                        winning_bid.platform, winning_bid.channel_name,
                        winning_bid.bid_amount, f"Auction cancelled: {auction.title}", db
                    )
                
                message = f'Аукцион "{auction.title}" отменен (недостаточно участников)'
                
            else:
                # Завершаем аукцион
                auction.status = 'completed'
                auction.completed_at = datetime.utcnow()
                
                if winning_bid:
                    auction.winner_id = winning_bid.bidder_id
                    auction.winner_name = winning_bid.bidder_name
                    auction.winner_platform = winning_bid.platform
                    message = f'🎉 Аукцион завершен! Победитель: {winning_bid.bidder_name} ({winning_bid.bid_amount} баллов)'
                else:
                    message = f'Аукцион "{auction.title}" завершен без ставок'
            
            db.commit()
            
            # Удаляем из кэша
            if auction_id in self.active_auctions:
                del self.active_auctions[auction_id]
            
            logger.info(f"Ended auction {auction_id}: {auction.status}")
            
            return {
                'success': True,
                'message': message,
                'auction': self._format_auction(auction),
                'winner': {
                    'name': auction.winner_name,
                    'platform': auction.winner_platform,
                    'bid': auction.current_bid
                } if auction.winner_name else None
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error ending auction: {e}")
            return {'success': False, 'error': 'Ошибка завершения аукциона'}
        finally:
            db.close()
    
    def get_active_auctions(self, user_id: int, db: Session = None) -> List[Dict[str, Any]]:
        """Получение активных аукционов"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            auctions = db.query(Auction).filter(
                and_(
                    Auction.user_id == user_id,
                    Auction.status == 'active'
                )
            ).order_by(asc(Auction.ends_at)).all()
            
            result = []
            for auction in auctions:
                result.append(self._format_auction(auction))
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting active auctions: {e}")
            return []
        finally:
            if should_close:
                db.close()
    
    def get_auction_history(self, user_id: int, limit: int = 20, db: Session = None) -> List[Dict[str, Any]]:
        """Получение истории аукционов"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            auctions = db.query(Auction).filter(
                and_(
                    Auction.user_id == user_id,
                    Auction.status.in_(['completed', 'cancelled'])
                )
            ).order_by(desc(Auction.completed_at)).limit(limit).all()
            
            result = []
            for auction in auctions:
                result.append(self._format_auction(auction))
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting auction history: {e}")
            return []
        finally:
            if should_close:
                db.close()
    
    def get_auction_bids(self, auction_id: int, db: Session = None) -> List[Dict[str, Any]]:
        """Получение ставок аукциона"""
        
        if db is None:
            db = next(get_db())
            should_close = True
        else:
            should_close = False
        
        try:
            bids = db.query(AuctionBid).filter(
                AuctionBid.auction_id == auction_id
            ).order_by(desc(AuctionBid.created_at)).all()
            
            result = []
            for bid in bids:
                result.append({
                    'id': bid.id,
                    'bidder_name': bid.bidder_name,
                    'platform': bid.platform,
                    'bid_amount': bid.bid_amount,
                    'created_at': bid.created_at.isoformat() if bid.created_at else None
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting auction bids: {e}")
            return []
        finally:
            if should_close:
                db.close()
    
    def _format_auction(self, auction: Auction) -> Dict[str, Any]:
        """Форматирование данных аукциона для API"""
        now = datetime.utcnow()
        
        time_left = 0
        if auction.status == 'active' and auction.ends_at:
            time_left = max(0, (auction.ends_at - now).total_seconds())
        
        return {
            'id': auction.id,
            'title': auction.title,
            'description': auction.description,
            'image_url': auction.image_url,
            'starting_bid': auction.starting_bid,
            'current_bid': auction.current_bid,
            'bid_increment': auction.bid_increment,
            'duration_minutes': auction.duration_minutes,
            'status': auction.status,
            'winner_name': auction.winner_name,
            'winner_platform': auction.winner_platform,
            'platforms': auction.platforms,
            'auto_extend': auction.auto_extend,
            'min_participants': auction.min_participants,
            'max_bid_limit': auction.max_bid_limit,
            'time_left': int(time_left),
            'created_at': auction.created_at.isoformat() if auction.created_at else None,
            'started_at': auction.started_at.isoformat() if auction.started_at else None,
            'ends_at': auction.ends_at.isoformat() if auction.ends_at else None,
            'completed_at': auction.completed_at.isoformat() if auction.completed_at else None
        }
    
    # === ДОПОЛНИТЕЛЬНЫЕ АЗАРТНЫЕ ИГРЫ ===
    
    def spin_wheel(self, user_id: int, participant_id: str, participant_name: str, platform: str, channel_name: str, bet_amount: int) -> Dict[str, Any]:
        """Колесо фортуны"""
        
        db = next(get_db())
        try:
            # Проверяем баллы
            user_points = self.points_service.get_user_points(
                user_id, participant_id, platform, channel_name, db
            )
            
            if user_points < bet_amount:
                return {'success': False, 'error': f'Недостаточно баллов. У вас: {user_points}'}
            
            # Списываем ставку
            deduct_result = self.points_service.deduct_points(
                user_id, participant_id, participant_name, platform, channel_name,
                bet_amount, "Wheel spin", db
            )
            
            if not deduct_result['success']:
                return deduct_result
            
            # Крутим колесо (различные секторы с разными множителями)
            wheel_sectors = [
                {'multiplier': 0, 'probability': 0.4, 'name': 'Пусто'},      # 40%
                {'multiplier': 1.5, 'probability': 0.25, 'name': 'x1.5'},    # 25%  
                {'multiplier': 2, 'probability': 0.15, 'name': 'x2'},        # 15%
                {'multiplier': 3, 'probability': 0.1, 'name': 'x3'},         # 10%
                {'multiplier': 5, 'probability': 0.05, 'name': 'x5'},        # 5%
                {'multiplier': 10, 'probability': 0.04, 'name': 'x10'},      # 4%
                {'multiplier': 50, 'probability': 0.01, 'name': 'ДЖЕКПОТ!'}  # 1%
            ]
            
            # Выбираем сектор
            rand = random.random()
            cumulative = 0
            result_sector = wheel_sectors[0]
            
            for sector in wheel_sectors:
                cumulative += sector['probability']
                if rand <= cumulative:
                    result_sector = sector
                    break
            
            # Рассчитываем выигрыш
            win_amount = int(bet_amount * result_sector['multiplier'])
            is_win = win_amount > bet_amount
            
            # Начисляем выигрыш
            if win_amount > 0:
                self.points_service.add_points(
                    user_id, participant_id, participant_name, platform, channel_name,
                    win_amount, f"Wheel win: {result_sector['name']}", db
                )
            
            # Сохраняем результат
            from core.database import GamblingResult
            result = GamblingResult(
                user_id=user_id,
                participant_id=participant_id,
                participant_name=participant_name,
                platform=platform,
                channel_name=channel_name,
                game_type='wheel',
                bet_amount=bet_amount,
                win_amount=win_amount,
                is_win=is_win,
                game_data={'sector': result_sector['name'], 'multiplier': result_sector['multiplier']}
            )
            
            db.add(result)
            db.commit()
            
            logger.info(f"Wheel spin: {participant_name} bet {bet_amount}, got {result_sector['name']}, won {win_amount}")
            
            return {
                'success': True,
                'result': result_sector['name'],
                'multiplier': result_sector['multiplier'],
                'bet_amount': bet_amount,
                'win_amount': win_amount,
                'is_win': is_win,
                'message': f"🎰 Выпало: {result_sector['name']}! " + 
                          (f"Выигрыш: {win_amount} баллов!" if is_win else "Удачи в следующий раз!")
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error in wheel spin: {e}")
            return {'success': False, 'error': 'Ошибка игры'}
        finally:
            db.close()
    
    def roll_dice(self, user_id: int, participant_id: str, participant_name: str, platform: str, channel_name: str, bet_amount: int, prediction: int) -> Dict[str, Any]:
        """Игра в кости"""
        
        db = next(get_db())
        try:
            if prediction < 1 or prediction > 6:
                return {'success': False, 'error': 'Выберите число от 1 до 6'}
            
            # Проверяем баллы
            user_points = self.points_service.get_user_points(
                user_id, participant_id, platform, channel_name, db
            )
            
            if user_points < bet_amount:
                return {'success': False, 'error': f'Недостаточно баллов. У вас: {user_points}'}
            
            # Списываем ставку
            deduct_result = self.points_service.deduct_points(
                user_id, participant_id, participant_name, platform, channel_name,
                bet_amount, "Dice roll", db
            )
            
            if not deduct_result['success']:
                return deduct_result
            
            # Бросаем кость
            dice_result = random.randint(1, 6)
            
            # Рассчитываем выигрыш (точное попадание = x6)
            win_amount = 0
            is_win = False
            
            if dice_result == prediction:
                win_amount = bet_amount * 6
                is_win = True
                
                self.points_service.add_points(
                    user_id, participant_id, participant_name, platform, channel_name,
                    win_amount, f"Dice win: {dice_result}", db
                )
            
            # Сохраняем результат
            from core.database import GamblingResult
            result = GamblingResult(
                user_id=user_id,
                participant_id=participant_id,
                participant_name=participant_name,
                platform=platform,
                channel_name=channel_name,
                game_type='dice',
                bet_amount=bet_amount,
                win_amount=win_amount,
                is_win=is_win,
                game_data={'dice_result': dice_result, 'prediction': prediction}
            )
            
            db.add(result)
            db.commit()
            
            logger.info(f"Dice roll: {participant_name} bet {bet_amount} on {prediction}, rolled {dice_result}, won {win_amount}")
            
            return {
                'success': True,
                'dice_result': dice_result,
                'prediction': prediction,
                'bet_amount': bet_amount,
                'win_amount': win_amount,
                'is_win': is_win,
                'message': f"🎲 Выпало: {dice_result}! " + 
                          (f"Точное попадание! Выигрыш: {win_amount} баллов!" if is_win else f"Не угадали. Было: {prediction}")
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error in dice roll: {e}")
            return {'success': False, 'error': 'Ошибка игры'}
        finally:
            db.close()
