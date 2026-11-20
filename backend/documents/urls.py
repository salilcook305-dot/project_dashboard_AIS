from django.urls import path
from .views import document_download_view, document_delete_view

urlpatterns = [
    path('<int:pk>/download/', document_download_view, name='document-download'),
    path('<int:pk>/', document_delete_view, name='document-delete'),
]

