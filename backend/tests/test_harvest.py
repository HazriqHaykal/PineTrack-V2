"""
Tests for Harvest Management Module
"""

import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.models import Harvest, User
from app.schemas import HarvestCreate, HarvestUpdate
from app.services.harvest_service import HarvestService
from app.config import Base, engine, SessionLocal


@pytest.fixture
def db_session():
    """Create a test database session"""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user(db_session):
    """Create a test user"""
    user = User(
        username="testworker",
        email="worker@test.com",
        password_hash="hashed_password",
        full_name="Test Worker",
        role="worker"
    )
    db_session.add(user)
    db_session.commit()
    return user


class TestHarvestCreation:
    """Test harvest creation functionality"""
    
    def test_create_harvest_success(self, db_session, test_user):
        """Test successful harvest creation"""
        harvest_data = HarvestCreate(
            field_name="Field A",
            harvest_date=date.today(),
            quantity_kg=150.5,
            quality_grade="A",
            notes="Good yield"
        )
        
        harvest = HarvestService.create_harvest(db_session, harvest_data, test_user.id)
        
        assert harvest.id is not None
        assert harvest.user_id == test_user.id
        assert harvest.field_name == "Field A"
        assert harvest.quantity_kg == 150.5
        assert harvest.quality_grade == "A"
        assert harvest.notes == "Good yield"
    
    def test_create_harvest_without_quality_grade(self, db_session, test_user):
        """Test harvest creation without explicit quality grade"""
        harvest_data = HarvestCreate(
            field_name="Field B",
            harvest_date=date.today(),
            quantity_kg=100.0,
            quality_grade=None
        )
        
        harvest = HarvestService.create_harvest(db_session, harvest_data, test_user.id)
        
        assert harvest.quality_grade == "ungraded"


class TestHarvestRetrieval:
    """Test harvest retrieval functionality"""
    
    def test_get_harvest_by_id(self, db_session, test_user):
        """Test getting harvest by ID"""
        harvest_data = HarvestCreate(
            field_name="Field C",
            harvest_date=date.today(),
            quantity_kg=200.0
        )
        created = HarvestService.create_harvest(db_session, harvest_data, test_user.id)
        
        retrieved = HarvestService.get_harvest_by_id(db_session, created.id)
        
        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.field_name == "Field C"
    
    def test_get_nonexistent_harvest(self, db_session):
        """Test getting a harvest that doesn't exist"""
        retrieved = HarvestService.get_harvest_by_id(db_session, 9999)
        assert retrieved is None
    
    def test_list_harvests_pagination(self, db_session, test_user):
        """Test harvest listing with pagination"""
        # Create multiple harvests
        for i in range(5):
            harvest_data = HarvestCreate(
                field_name=f"Field {i}",
                harvest_date=date.today() - timedelta(days=i),
                quantity_kg=100.0 + i * 10
            )
            HarvestService.create_harvest(db_session, harvest_data, test_user.id)
        
        # Test pagination
        harvests, total = HarvestService.list_harvests(
            db_session, 
            user_id=test_user.id, 
            skip=0, 
            limit=3
        )
        
        assert total == 5
        assert len(harvests) == 3
    
    def test_list_harvests_user_filter(self, db_session, test_user):
        """Test harvest listing filtered by user"""
        harvest_data = HarvestCreate(
            field_name="User Field",
            harvest_date=date.today(),
            quantity_kg=100.0
        )
        HarvestService.create_harvest(db_session, harvest_data, test_user.id)
        
        # Create another user
        other_user = User(
            username="otherworker",
            email="other@test.com",
            password_hash="hashed",
            role="worker"
        )
        db_session.add(other_user)
        db_session.commit()
        
        HarvestService.create_harvest(db_session, harvest_data, other_user.id)
        
        # Test filter
        harvests, total = HarvestService.list_harvests(
            db_session, 
            user_id=test_user.id
        )
        
        assert total == 1
        assert harvests[0].user_id == test_user.id


class TestHarvestUpdate:
    """Test harvest update functionality"""
    
    def test_update_harvest_quality_grade(self, db_session, test_user):
        """Test updating harvest quality grade"""
        harvest_data = HarvestCreate(
            field_name="Field D",
            harvest_date=date.today(),
            quantity_kg=150.0,
            quality_grade="B"
        )
        harvest = HarvestService.create_harvest(db_session, harvest_data, test_user.id)
        
        update_data = HarvestUpdate(quality_grade="A", notes="Upgraded")
        updated = HarvestService.update_harvest(db_session, harvest.id, update_data)
        
        assert updated.quality_grade == "A"
        assert updated.notes == "Upgraded"
    
    def test_update_nonexistent_harvest(self, db_session):
        """Test updating a harvest that doesn't exist"""
        update_data = HarvestUpdate(quality_grade="A")
        updated = HarvestService.update_harvest(db_session, 9999, update_data)
        assert updated is None


class TestHarvestDeletion:
    """Test harvest deletion functionality"""
    
    def test_delete_harvest_success(self, db_session, test_user):
        """Test successful harvest deletion"""
        harvest_data = HarvestCreate(
            field_name="Field E",
            harvest_date=date.today(),
            quantity_kg=100.0
        )
        harvest = HarvestService.create_harvest(db_session, harvest_data, test_user.id)
        
        deleted = HarvestService.delete_harvest(db_session, harvest.id)
        
        assert deleted is True
        assert HarvestService.get_harvest_by_id(db_session, harvest.id) is None
    
    def test_delete_nonexistent_harvest(self, db_session):
        """Test deleting a harvest that doesn't exist"""
        deleted = HarvestService.delete_harvest(db_session, 9999)
        assert deleted is False


class TestHarvestStatistics:
    """Test harvest statistics functionality"""
    
    def test_get_statistics_basic(self, db_session, test_user):
        """Test getting basic harvest statistics"""
        harvests_data = [
            HarvestCreate(field_name="F1", harvest_date=date.today(), quantity_kg=100.0, quality_grade="A"),
            HarvestCreate(field_name="F2", harvest_date=date.today(), quantity_kg=150.0, quality_grade="B"),
            HarvestCreate(field_name="F3", harvest_date=date.today(), quantity_kg=200.0, quality_grade="A"),
        ]
        
        for data in harvests_data:
            HarvestService.create_harvest(db_session, data, test_user.id)
        
        stats = HarvestService.get_harvest_statistics(db_session, user_id=test_user.id)
        
        assert stats["total_harvests"] == 3
        assert stats["total_quantity_kg"] == 450.0
        assert stats["average_quantity_kg"] == 150.0
        assert stats["quality_grades"]["A"] == 2
        assert stats["quality_grades"]["B"] == 1
    
    def test_get_statistics_date_range(self, db_session, test_user):
        """Test statistics with date range filtering"""
        today = date.today()
        
        # Create harvest for today
        harvest_data = HarvestCreate(
            field_name="F1",
            harvest_date=today,
            quantity_kg=100.0
        )
        HarvestService.create_harvest(db_session, harvest_data, test_user.id)
        
        # Create harvest for 5 days ago
        old_data = HarvestCreate(
            field_name="F2",
            harvest_date=today - timedelta(days=5),
            quantity_kg=200.0
        )
        HarvestService.create_harvest(db_session, old_data, test_user.id)
        
        # Get statistics for last 2 days
        stats = HarvestService.get_harvest_statistics(
            db_session,
            user_id=test_user.id,
            start_date=today - timedelta(days=2),
            end_date=today
        )
        
        assert stats["total_harvests"] == 1
        assert stats["total_quantity_kg"] == 100.0


class TestHarvestValidation:
    """Test harvest data validation"""
    
    def test_validate_valid_data(self):
        """Test validation of valid harvest data"""
        harvest_data = HarvestCreate(
            field_name="Valid Field",
            harvest_date=date.today(),
            quantity_kg=100.0,
            quality_grade="A"
        )
        
        is_valid, error = HarvestService.validate_harvest_data(harvest_data)
        assert is_valid is True
        assert error is None
    
    def test_validate_negative_quantity(self):
        """Test validation of negative quantity"""
        harvest_data = HarvestCreate(
            field_name="Field",
            harvest_date=date.today(),
            quantity_kg=-10.0
        )
        
        is_valid, error = HarvestService.validate_harvest_data(harvest_data)
        assert is_valid is False
        assert "greater than 0" in error
    
    def test_validate_empty_field_name(self):
        """Test validation of empty field name"""
        harvest_data = HarvestCreate(
            field_name="   ",
            harvest_date=date.today(),
            quantity_kg=100.0
        )
        
        is_valid, error = HarvestService.validate_harvest_data(harvest_data)
        assert is_valid is False
        assert "empty" in error
    
    def test_validate_future_date(self):
        """Test validation of future harvest date"""
        harvest_data = HarvestCreate(
            field_name="Field",
            harvest_date=date.today() + timedelta(days=1),
            quantity_kg=100.0
        )
        
        is_valid, error = HarvestService.validate_harvest_data(harvest_data)
        assert is_valid is False
        assert "future" in error
    
    def test_validate_invalid_quality_grade(self):
        """Test validation of invalid quality grade"""
        harvest_data = HarvestCreate(
            field_name="Field",
            harvest_date=date.today(),
            quantity_kg=100.0,
            quality_grade="Z"
        )
        
        is_valid, error = HarvestService.validate_harvest_data(harvest_data)
        assert is_valid is False
        assert "Quality grade" in error


class TestHarvestFieldQuery:
    """Test field-based harvest queries"""
    
    def test_get_harvests_by_field(self, db_session, test_user):
        """Test getting all harvests from a specific field"""
        # Create harvests from same field
        for i in range(3):
            harvest_data = HarvestCreate(
                field_name="Main Field",
                harvest_date=date.today() - timedelta(days=i),
                quantity_kg=100.0 + i * 10
            )
            HarvestService.create_harvest(db_session, harvest_data, test_user.id)
        
        # Create harvest from different field
        other_data = HarvestCreate(
            field_name="Other Field",
            harvest_date=date.today(),
            quantity_kg=150.0
        )
        HarvestService.create_harvest(db_session, other_data, test_user.id)
        
        # Query
        harvests = HarvestService.get_harvests_by_field(db_session, "Main Field")
        
        assert len(harvests) == 3
        assert all(h.field_name == "Main Field" for h in harvests)
