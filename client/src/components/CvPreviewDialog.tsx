import { Download, FileText } from 'lucide-react';
import { downloadCvFile } from '../services/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface CvPreview {
  url: string;
  contentType: string;
  fileName: string;
  fileId: number;
}

interface CvPreviewDialogProps {
  candidateId: number;
  preview: CvPreview;
  onClose: () => void;
}

/* The CV viewer, shared by the Candidate Detail page and the profile drawer.

   A CV is a full page of dense text, and the point of previewing it in the
   app rather than downloading it is to read it, so the viewer takes almost
   the whole window. The caller owns the blob URL and revokes it on close. */
export default function CvPreviewDialog({ candidateId, preview, onClose }: CvPreviewDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:h-[92dvh] sm:max-h-[92dvh] sm:max-w-[min(76rem,95vw)]">
        <DialogHeader className="flex-row items-center justify-between gap-3">
          <DialogTitle className="flex min-w-0 items-center gap-2">
            <FileText size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{preview.fileName}</span>
          </DialogTitle>
          <Button
            size="sm"
            variant="outline"
            className="mr-6 shrink-0"
            onClick={() => void downloadCvFile(candidateId, preview.fileId)}
          >
            <Download size={14} strokeWidth={1.75} aria-hidden="true" />
            Download
          </Button>
        </DialogHeader>
        {/* p-0 so the document meets the dialog's edges: padding around a
            page of A4 is wasted reading width. */}
        <DialogBody className="flex flex-col p-0">
          {preview.contentType.includes('pdf') ? (
            <iframe
              title={`Preview of ${preview.fileName}`}
              src={preview.url}
              className="h-full min-h-0 w-full flex-1 border-0 bg-white"
            />
          ) : (
            <div className="m-auto flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
              <FileText size={36} strokeWidth={1.5} aria-hidden="true" />
              <p>In-app preview isn't available for this file type.</p>
              <Button
                size="sm"
                onClick={() => void downloadCvFile(candidateId, preview.fileId)}
              >
                <Download size={14} strokeWidth={1.75} aria-hidden="true" />
                Download file
              </Button>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
