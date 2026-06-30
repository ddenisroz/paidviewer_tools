import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MemeAlertsHistoryCard } from './MemeAlertsHistoryCard';

describe('MemeAlertsHistoryCard', () => {
    it('hides numeric manual labels and shows transaction amount in history rows', () => {
        render(
            <MemeAlertsHistoryCard
                historyRows={[
                    {
                        id: 1,
                        source: 'ui',
                        type: 'ui',
                        user_name: '1',
                        platform_user_name: '1',
                        memealerts_name: 'Yourchy',
                        created_at: '2026-05-22T15:31:42Z',
                        amount: 1,
                    },
                ]}
                historyLoading={false}
                balanceRows={[]}
                balancesLoading={false}
                onRefreshHistory={vi.fn()}
                onRefreshBalances={vi.fn()}
            />
        );

        expect(screen.getByText('MemeAlerts: Yourchy')).toBeInTheDocument();
        expect(screen.getByText('+1')).toBeInTheDocument();
        expect(screen.queryByText(/^1$/)).not.toBeInTheDocument();
    });
});
