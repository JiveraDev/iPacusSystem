import { useId, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { fetchPetDetails, updatePetDetails } from '../../services/petService';
import { petInformationChanges, petInformationDraft } from '../../lib/petInformation';
import { calculateAge } from '../../lib/date';
import { toast } from '../../reusecomponent/toast';
import {
    PET_INPUT_LIMITS,
    isPetBreedText,
    isPetMarkingsText,
    isPetMicrochipText,
    isPetNameText,
    isPetSpeciesText,
    isPetWeightText,
} from '../../lib/petInputValidation';

export default function EditPetInformationDialog({ petId, onClose, onSaved }) {
    const prefix = useId();
    const [pet, setPet] = useState(null);
    const [draft, setDraft] = useState(petInformationDraft());
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const editing = useRef(false);
    const saving = useRef(false);
    const load = async () => {
        try {
            const latest = await fetchPetDetails(petId);
            if (editing.current || saving.current) return;
            setPet(latest); setDraft(petInformationDraft(latest)); setError('');
        } catch (err) { setError(err.message); }
    };
    useAutoRefresh(load, { enabled: !dirty && !busy, refreshKey: petId });
    const change = (key, value) => { editing.current = true; setDirty(true); setDraft((current) => ({ ...current, [key]: value })); };
    const close = () => {
        if (saving.current) return;
        if (!dirty || window.confirm('Discard your unsaved pet information changes?')) onClose();
    };
    const submit = async (event) => {
        event.preventDefault();
        if (saving.current || !pet) return;
        const normalized = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()]));
        if (!normalized.petName || !normalized.species) { setError('Enter the pet name and species.'); return; }
        if (!isPetNameText(normalized.petName)) { setError(`Pet name may contain letters, spaces, periods, apostrophes, and hyphens, up to ${PET_INPUT_LIMITS.name} characters.`); return; }
        if (!isPetSpeciesText(normalized.species)) { setError(`Species may contain letters, spaces, periods, apostrophes, and hyphens, up to ${PET_INPUT_LIMITS.species} characters.`); return; }
        if (normalized.breed && !isPetBreedText(normalized.breed)) { setError(`Breed contains unsupported characters or exceeds ${PET_INPUT_LIMITS.breed} characters.`); return; }
        if (!isPetWeightText(normalized.weight)) { setError('Weight must be between 0.1 and 300 kg with no more than two decimal places.'); return; }
        if (!isPetMarkingsText(normalized.color)) { setError(`Color and markings must use letters and spaces only, up to ${PET_INPUT_LIMITS.colorMarkings} characters.`); return; }
        if (!isPetMicrochipText(normalized.microchipId)) { setError(`Microchip number must contain up to ${PET_INPUT_LIMITS.microchip} digits.`); return; }
        const changes = petInformationChanges(petInformationDraft(pet), normalized);
        if (!Object.keys(changes).length) { onClose(); return; }
        if (Object.hasOwn(changes, 'birthDate')) changes.age = changes.birthDate ? calculateAge(changes.birthDate) : null;
        saving.current = true; setBusy(true); setError('');
        try {
            await updatePetDetails(pet.db_id || petId, changes);
            let latest = { ...pet, ...changes, name: normalized.petName, petName: normalized.petName };
            try { latest = await fetchPetDetails(petId); }
            catch { toast.warning('Pet information saved. Some profile details could not be refreshed yet.'); }
            onSaved(latest);
            toast.success('Pet information updated.');
            onClose();
        } catch (err) { setError(err.message || 'Pet information could not be saved. Please try again.'); }
        finally { saving.current = false; setBusy(false); }
    };
    const input = (key, label, props = {}) => <div className="space-y-1.5"><Label htmlFor={`${prefix}-${key}`}>{label}</Label><Input id={`${prefix}-${key}`} value={draft[key]} onChange={(event) => change(key, event.target.value)} maxLength={100} {...props} /></div>;
    const today = new Date().toLocaleDateString('en-CA');
    const genders = [...new Set(['Male', 'Female', 'Neutered Male', 'Spayed Female', 'Unknown', draft.gender].filter(Boolean))];
    return <Dialog open onOpenChange={(open) => { if (!open) close(); }}><DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit pet information</DialogTitle><DialogDescription>Update basic pet details. Ownership, diagnoses, vaccinations, and other medical records are managed separately.</DialogDescription></DialogHeader>
        {error && <div role="alert" className="space-y-2 text-sm text-rose-700 dark:text-rose-300"><p>{error}</p>{!pet && <Button variant="outline" onClick={load}>Try again</Button>}</div>}
        {!pet ? <p role="status" className="py-4 text-sm text-slate-500">{error ? 'Pet information is unavailable.' : 'Loading pet information…'}</p> : <form onSubmit={submit}>
            <fieldset disabled={busy} className="grid gap-4 py-4 sm:grid-cols-2">
                {input('petName', 'Pet name', { required: true, restriction: 'pet-name', maxLength: PET_INPUT_LIMITS.name })}
                {input('species', 'Species', { required: true, restriction: 'pet-name', maxLength: PET_INPUT_LIMITS.species })}
                {input('breed', 'Breed', { restriction: 'pet-breed', maxLength: PET_INPUT_LIMITS.breed })}
                {input('birthDate', 'Birth date', { type: 'date', max: today })}
                <div className="space-y-1.5"><Label htmlFor={`${prefix}-gender`}>Sex / gender</Label><Select value={draft.gender || 'Unknown'} onValueChange={(value) => change('gender', value)} disabled={busy}><SelectTrigger id={`${prefix}-gender`}><SelectValue /></SelectTrigger><SelectContent>{genders.map((gender) => <SelectItem key={gender} value={gender}>{gender}</SelectItem>)}</SelectContent></Select></div>
                {input('weight', 'Weight (kg)', { restriction: 'pet-weight', maxLength: PET_INPUT_LIMITS.weight })}
                {input('color', 'Color / markings', { restriction: 'pet-markings', maxLength: PET_INPUT_LIMITS.colorMarkings })}
                {input('microchipId', 'Microchip number', { restriction: 'pet-microchip', maxLength: PET_INPUT_LIMITS.microchip, pattern: '[0-9]{0,15}' })}
            </fieldset>
            <DialogFooter><Button type="button" variant="outline" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || !dirty}>{busy && <Loader2 className="size-4 animate-spin" />}{busy ? 'Saving…' : 'Save changes'}</Button></DialogFooter>
        </form>}
    </DialogContent></Dialog>;
}
