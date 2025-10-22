"""create_unified_user_model

Revision ID: da709b00ae1f
Revises: 738b81426214
Create Date: 2025-09-23 14:41:35.412467

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da709b00ae1f'
down_revision: Union[str, Sequence[str], None] = '738b81426214'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to unified user model using batch mode for SQLite."""
    # Step 0: Clean up any artifacts from previous failed migrations
    op.drop_table('users_unified', if_exists=True)

    # Step 1: Create the new 'users' table that will become the unified user table.
    op.create_table('users_unified',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('display_name', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False)
    )

    # Step 2: Perform data migration to populate the new unified users table
    # and create a mapping from old string IDs to new integer IDs.
    bind = op.get_bind()
    session = sa.orm.Session(bind=bind)
    old_to_new_id_map = {}

    try:
        # We assume user_tokens contains all users that need to be migrated.
        old_users_result = session.execute(sa.text("SELECT DISTINCT user_id FROM user_tokens")).fetchall()
        
        for row in old_users_result:
            old_id = row[0]
            # Create a new entry in the unified table and get its new integer ID.
            new_user_result = session.execute(
                sa.text("INSERT INTO users_unified (display_name, created_at) VALUES (:name, :created_at) RETURNING id"),
                {'name': old_id, 'created_at': sa.func.now()}
            )
            new_id = new_user_result.scalar_one()
            old_to_new_id_map[old_id] = new_id
        
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

    # Step 3: Alter 'user_tokens' table
    with op.batch_alter_table('user_tokens', schema=None) as batch_op:
        batch_op.add_column(sa.Column('unified_user_id', sa.Integer(), nullable=True))

    # Populate the newly added column with the new unified IDs
    session = sa.orm.Session(bind=bind)
    try:
        for old_id, new_id in old_to_new_id_map.items():
            session.execute(
                sa.text("UPDATE user_tokens SET unified_user_id = :new_id WHERE user_id = :old_id"),
                {'new_id': new_id, 'old_id': old_id}
            )
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()
    
    with op.batch_alter_table('user_tokens', schema=None) as batch_op:
        batch_op.drop_column('user_id')
        batch_op.alter_column('unified_user_id',
                              new_column_name='user_id',
                              nullable=False)
        batch_op.create_foreign_key('fk_user_tokens_users', 'users_unified', ['user_id'], ['id'])

    # Step 4: Alter 'user_sessions' table
    with op.batch_alter_table('user_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('unified_user_id', sa.Integer(), nullable=True))

    session = sa.orm.Session(bind=bind)
    try:
        for old_id, new_id in old_to_new_id_map.items():
            session.execute(
                sa.text("UPDATE user_sessions SET unified_user_id = :new_id WHERE user_id = :old_id"),
                {'new_id': new_id, 'old_id': old_id}
            )
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

    with op.batch_alter_table('user_sessions', schema=None) as batch_op:
        batch_op.drop_column('user_id')
        batch_op.alter_column('unified_user_id',
                              new_column_name='user_id',
                              nullable=False)
        batch_op.create_foreign_key('fk_user_sessions_users', 'users_unified', ['user_id'], ['id'])

    # Step 5: Clean up by dropping the old 'users' table and renaming the new one.
    op.drop_table('users')
    op.rename_table('users_unified', 'users')


def downgrade() -> None:
    """Downgrade schema to the old user model. This is a destructive operation."""
    # Step 0: Clean up any artifacts from previous failed migrations
    op.drop_table('users_unified', if_exists=True)
    
    # This downgrade is simplified and will likely result in loss of associations.
    # It mainly serves to revert the schema for development purposes.
    op.rename_table('users', 'users_unified')
    op.create_table('users',
        sa.Column('id', sa.String(), nullable=False, primary_key=True),
        # ... other columns from the original 'users' table
        sa.Column('username', sa.String(), nullable=True),
        sa.Column('display_name', sa.String(), nullable=True),
    )

    with op.batch_alter_table('user_tokens', schema=None) as batch_op:
        batch_op.drop_constraint('fk_user_tokens_users', type_='foreignkey')
        batch_op.add_column(sa.Column('old_user_id_str', sa.String(), nullable=True))
        # Code to populate old_user_id_str would be needed here for a full downgrade
        batch_op.drop_column('user_id')
        batch_op.alter_column('old_user_id_str', new_column_name='user_id')
    
    with op.batch_alter_table('user_sessions', schema=None) as batch_op:
        batch_op.drop_constraint('fk_user_sessions_users', type_='foreignkey')
        batch_op.add_column(sa.Column('old_user_id_str', sa.String(), nullable=True))
        batch_op.drop_column('user_id')
        batch_op.alter_column('old_user_id_str', new_column_name='user_id')

    op.drop_table('users_unified', if_exists=True)
