import os
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from projects.models import Project
from projects.permissions import IsManagerOrAdmin
from .models import Document
from .serializers import DocumentSerializer
from .validators import validate_document_file


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def project_documents_view(request, project_id):
    project = get_object_or_404(Project, pk=project_id)

    if request.method == 'GET':
        docs = project.documents.all().order_by('-uploaded_at')
        return Response(DocumentSerializer(docs, many=True).data)

    if request.user.role not in ('ADMIN', 'MANAGER') and not request.user.is_superuser:
        return Response(
            {'detail': 'Only Admins and Managers have permission to upload documents.'},
            status=status.HTTP_403_FORBIDDEN
        )

    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'detail': 'No file was provided in the request.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_document_file(file_obj)
    except Exception as exc:
        msg = ', '.join(exc.messages) if hasattr(exc, 'messages') else str(exc)
        return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

    doc_type = request.data.get('doc_type', Document.DocType.DOCUMENTATION)
    if doc_type not in Document.DocType.values:
        doc_type = Document.DocType.DOCUMENTATION

    doc = Document(
        project=project,
        original_name=file_obj.name,
        doc_type=doc_type,
        size_bytes=file_obj.size,
        file=file_obj,
        uploaded_by=request.user,
    )
    doc.save()
    return Response(DocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def document_download_view(request, pk):
    doc = get_object_or_404(Document, pk=pk)
    if not doc.file or not os.path.exists(doc.file.path):
        raise Http404('The requested file was not found on the secure server storage.')

    file_handle = doc.file.open('rb')
    return FileResponse(file_handle, as_attachment=True, filename=doc.original_name)


@api_view(['DELETE'])
@permission_classes([IsManagerOrAdmin])
def document_delete_view(request, pk):
    doc = get_object_or_404(Document, pk=pk)
    if doc.file:
        try:
            doc.file.close()
            doc.file.delete(save=False)
        except Exception:
            pass
    doc.delete()
    return Response({'detail': 'Document removed successfully.'}, status=status.HTTP_200_OK)
