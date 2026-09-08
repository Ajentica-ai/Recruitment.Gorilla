import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../ToastStack';
import { createOffer, updateOffer } from '../../services/api';
import type { CreateOfferPayload, Offer } from '../../types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { InputGroup } from '@/components/ui/input-group';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'BDT'];

interface CreateOfferModalProps {
  candidateId: number;
  existingOffer?: Offer | null;
  defaultJobTitle?: string | null;
  show: boolean;
  onHide: () => void;
  onSaved?: (offer: Offer) => void;
}

export default function CreateOfferModal({
  candidateId,
  existingOffer,
  defaultJobTitle,
  show,
  onHide,
  onSaved,
}: CreateOfferModalProps) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [jobTitle, setJobTitle] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [bonus, setBonus] = useState('');
  const [equity, setEquity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      if (existingOffer) {
        setJobTitle(existingOffer.jobTitle || '');
        setBaseSalary(existingOffer.baseSalary ? String(existingOffer.baseSalary) : '');
        setCurrency(existingOffer.currency || 'USD');
        setBonus(existingOffer.bonus ? String(existingOffer.bonus) : '');
        setEquity(existingOffer.equity || '');
        setStartDate(existingOffer.startDate ? existingOffer.startDate.split('T')[0] : '');
        setExpirationDate(existingOffer.expirationDate ? existingOffer.expirationDate.split('T')[0] : '');
        setNotes(existingOffer.notes || '');
      } else {
        setJobTitle(defaultJobTitle || '');
        setBaseSalary('');
        setCurrency('USD');
        setBonus('');
        setEquity('');
        setStartDate('');
        setExpirationDate('');
        setNotes('');
      }
      setError(null);
    }
  }, [show, existingOffer, defaultJobTitle]);

  const mutation = useMutation({
    mutationFn: async (payload: CreateOfferPayload) => {
      if (existingOffer) {
        return await updateOffer(candidateId, existingOffer.id, payload);
      }
      return await createOffer(candidateId, payload);
    },
    onSuccess: (savedOffer) => {
      void queryClient.invalidateQueries({ queryKey: ['candidate-offers', candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['candidate', candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      addToast(existingOffer ? 'Offer updated successfully' : 'Offer drafted successfully', 'success');
      onSaved?.(savedOffer);
      onHide();
    },
    onError: (err: any) => {
      const msg = err?.response?.data || 'Failed to save offer. Please check the inputs.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const salaryNum = parseFloat(baseSalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
      setError('Please enter a valid base salary greater than zero.');
      return;
    }

    const payload: CreateOfferPayload = {
      jobTitle: jobTitle.trim() || undefined,
      baseSalary: salaryNum,
      currency,
      bonus: bonus ? parseFloat(bonus) : null,
      equity: equity.trim() || null,
      startDate: startDate ? `${startDate}T00:00:00Z` : null,
      expirationDate: expirationDate ? `${expirationDate}T23:59:59Z` : null,
      notes: notes.trim() || null,
    };

    mutation.mutate(payload);
  };

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) { (onHide)(); } }}>
<DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>{existingOffer ? 'Edit Offer Terms' : 'Draft New Employment Offer'}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {error && <div className="alert alert-danger py-2 mb-4 text-[length:var(--text-sm)]">{error}</div>}

          <div className="flex flex-col gap-1.5 mb-4">
            <Label className="text-[length:var(--text-sm)] font-semibold">Job Title / Position</Label>
            <Input
              type="text"
              required
              placeholder="e.g. Senior Software Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-12 gap-2 mb-4">
            <div className="col-span-12 sm:col-span-8">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--text-sm)] font-semibold">Annual Base Salary</Label>
                <InputGroup>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="120000"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                  />
                </InputGroup>
              </div>
            </div>
            <div className="col-span-12 sm:col-span-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--text-sm)] font-semibold">Currency</Label>
                <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 mb-4">
            <div className="col-span-12 sm:col-span-6">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--text-sm)] font-semibold">Signing / Annual Bonus (Optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 15000"
                  value={bonus}
                  onChange={(e) => setBonus(e.target.value)}
                />
              </div>
            </div>
            <div className="col-span-12 sm:col-span-6">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--text-sm)] font-semibold">Equity / Options (Optional)</Label>
                <Input
                  type="text"
                  placeholder="e.g. 10,000 RSUs or 0.25%"
                  value={equity}
                  onChange={(e) => setEquity(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 mb-4">
            <div className="col-span-12 sm:col-span-6">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--text-sm)] font-semibold">Proposed Start Date</Label>
                <DatePicker value={startDate} onChange={setStartDate} />
              </div>
            </div>
            <div className="col-span-12 sm:col-span-6">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[length:var(--text-sm)] font-semibold">Offer Expiration Date</Label>
                <DatePicker value={expirationDate} onChange={setExpirationDate} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[length:var(--text-sm)] font-semibold">Additional Terms & Notes</Label>
            <Textarea
              rows={3}
              placeholder="e.g. Standard benefits package, 4 weeks PTO, hybrid schedule..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={onHide} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : existingOffer ? 'Save Changes' : 'Create Offer'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
</Dialog>
  );
}
