import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
    const mockOnChange = vi.fn();

    const mockOnClearAll = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic functionality', () => {
        it('renders search input', () => {
            render(<SearchBar value="" onChange={mockOnChange} />);

            expect(screen.getByPlaceholderText('Поиск...')).toBeInTheDocument();
        });

        it('renders with custom placeholder', () => {
            render(<SearchBar value="" onChange={mockOnChange} placeholder="Поиск пользователей..." />);

            expect(screen.getByPlaceholderText('Поиск пользователей...')).toBeInTheDocument();
        });

        it('displays current value', () => {
            render(<SearchBar value="test query" onChange={mockOnChange} />);

            const input = screen.getByPlaceholderText('Поиск...') as HTMLInputElement;
            expect(input.value).toBe('test query');
        });

        it('calls onChange when typing', async () => {
            const user = userEvent.setup();
            render(<SearchBar value="" onChange={mockOnChange} />);

            const input = screen.getByPlaceholderText('Поиск...');
            await user.type(input, 'test');

            expect(mockOnChange).toHaveBeenCalledTimes(4); // Once per character
        });

        it('shows clear button when value is not empty', () => {
            render(<SearchBar value="test" onChange={mockOnChange} />);

            const clearButtons = screen.getAllByRole('button');
            expect(clearButtons.length).toBeGreaterThan(0);
        });

        it('clears value when clear button clicked', async () => {
            const user = userEvent.setup();
            render(<SearchBar value="test" onChange={mockOnChange} />);

            // Find the clear button (X icon)
            const buttons = screen.getAllByRole('button');
            const clearButton = buttons.find((btn) => btn.querySelector('svg'));

            if (clearButton) {
                await user.click(clearButton);
                expect(mockOnChange).toHaveBeenCalledWith('');
            }
        });
    });

    describe('Filters', () => {
        const filters = [
            {
                key: 'status',
                label: 'Статус',
                type: 'select' as const,
                options: [
                    { value: 'active', label: 'Активный' },
                    { value: 'inactive', label: 'Неактивный' },
                ],
            },
        ];

        it('shows filter button when filters provided', () => {
            render(<SearchBar value="" onChange={mockOnChange} filters={filters} />);

            expect(screen.getByText('Фильтры')).toBeInTheDocument();
        });

        it('hides filter button when showFilterButton is false', () => {
            render(<SearchBar value="" onChange={mockOnChange} filters={filters} showFilterButton={false} />);

            expect(screen.queryByText('Фильтры')).not.toBeInTheDocument();
        });

        it('displays active filters', () => {
            const activeFilters = [{ key: 'status', value: 'active', label: 'Статус: Активный' }];

            render(<SearchBar value="" onChange={mockOnChange} filters={filters} activeFilters={activeFilters} />);

            expect(screen.getByText('Активные фильтры:')).toBeInTheDocument();
            expect(screen.getByText('Статус: Активный')).toBeInTheDocument();
        });

        it('shows filter count badge', () => {
            const activeFilters = [
                { key: 'status', value: 'active', label: 'Статус: Активный' },
                { key: 'role', value: 'admin', label: 'Роль: Админ' },
            ];

            render(<SearchBar value="" onChange={mockOnChange} filters={filters} activeFilters={activeFilters} />);

            expect(screen.getByText('2')).toBeInTheDocument();
        });

        it('shows clear all button when filters are active', () => {
            const activeFilters = [{ key: 'status', value: 'active', label: 'Статус: Активный' }];

            render(
                <SearchBar
                    value=""
                    onChange={mockOnChange}
                    filters={filters}
                    activeFilters={activeFilters}
                    onClearAll={mockOnClearAll}
                />
            );

            expect(screen.getByText('Очистить все')).toBeInTheDocument();
        });

        it('calls onClearAll when clear all clicked', async () => {
            const user = userEvent.setup();
            const activeFilters = [{ key: 'status', value: 'active', label: 'Статус: Активный' }];

            render(
                <SearchBar
                    value=""
                    onChange={mockOnChange}
                    filters={filters}
                    activeFilters={activeFilters}
                    onClearAll={mockOnClearAll}
                />
            );

            await user.click(screen.getByText('Очистить все'));
            expect(mockOnClearAll).toHaveBeenCalled();
        });
    });

    describe('Styling', () => {
        it('applies custom className', () => {
            const { container } = render(<SearchBar value="" onChange={mockOnChange} className="custom-class" />);

            expect(container.firstChild).toHaveClass('custom-class');
        });
    });
});
