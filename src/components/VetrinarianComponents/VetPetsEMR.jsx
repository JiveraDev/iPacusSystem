import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Search, Edit, Plus } from 'lucide-react';

interface EMRRecord {
    id: string;
    petId: string;
    petName: string;
    owner: string;
    date: string;
    diagnosis: string;
    treatment: string;
    medications: string;
    notes: string;
    followUp?: string;
}

export default function VetPetsEMR() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRecord, setSelectedRecord] = useState<EMRRecord | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const [emrRecords, setEmrRecords] = useState<EMRRecord[]>([
        {
            id: '1',
            petId: '1',
            petName: 'Max',
            owner: 'Test User',
            date: '2025-12-01',
            diagnosis: 'Routine checkup - healthy',
            treatment: 'Vaccination administered',
            medications: 'None',
            notes: 'Pet is in good health. Continue current diet.',
            followUp: '2026-06-01'
        },
        {
            id: '2',
            petId: '2',
            petName: 'Luna',
            owner: 'Jane Smith',
            date: '2025-11-15',
            diagnosis: 'Ear infection',
            treatment: 'Ear cleaning and medication',
            medications: 'Otibiotic ear drops - 2 drops twice daily for 7 days',
            notes: 'Monitor for improvement. Return if symptoms persist.',
            followUp: '2025-11-22'
        },
        {
            id: '3',
            petId: '4',
            petName: 'Bella',
            owner: 'Sarah Johnson',
            date: '2025-12-05',
            diagnosis: 'Minor laceration on left paw',
            treatment: 'Wound cleaning and bandaging',
            medications: 'Antibiotics - Amoxicillin 250mg twice daily for 5 days',
            notes: 'Keep wound dry. Change bandage daily.',
            followUp: '2025-12-12'
        }
    ]);

    const [formData, setFormData] = useState<Partial<EMRRecord>>({});

    const filteredRecords = emrRecords.filter(record =>
        record.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.diagnosis.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleEditRecord = (record: EMRRecord) => {
        setSelectedRecord(record);
        setFormData(record);
        setIsEditing(true);
        setDialogOpen(true);
    };

    const handleAddRecord = () => {
        setSelectedRecord(null);
        setFormData({
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            diagnosis: '',
            treatment: '',
            medications: '',
            notes: '',
            followUp: ''
        });
        setIsEditing(false);
        setDialogOpen(true);
    };

    const handleSaveRecord = () => {
        if (isEditing && selectedRecord) {
            setEmrRecords(prev =>
                prev.map(record =>
                    record.id === selectedRecord.id
                        ? { ...record, ...formData }
                        : record
                )
            );
        } else {
            setEmrRecords(prev => [...prev, formData as EMRRecord]);
        }
        setDialogOpen(false);
        setFormData({});
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828]">Diagnosis History</h2>

                </div>

            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-[#4a5565]" />
                <Input
                    type="text"
                    placeholder="Search by pet name, owner, or diagnosis..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 bg-white border border-[rgba(0,0,0,0.1)] rounded-[10px]"
                />
            </div>

            {/* EMR Table */}
            <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] overflow-hidden">
                <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.1)]">
                    <h3 className="font-['Arimo:Bold',sans-serif] font-bold text-[18px] text-[#101828]">Diagnosis Record</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-[#f9fafb]">
                        <tr>
                            <th className="px-6 py-3 text-left font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565]">
                                Date
                            </th>
                            <th className="px-6 py-3 text-left font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565]">
                                Pet Name
                            </th>
                            <th className="px-6 py-3 text-left font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565]">
                                Owner
                            </th>
                            <th className="px-6 py-3 text-left font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565]">
                                Diagnosis
                            </th>

                            <th className="px-6 py-3 text-left font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565]">
                                Follow-up
                            </th>
                            <th className="px-6 py-3 text-left font-['Arimo:Bold',sans-serif] text-[14px] text-[#4a5565]">
                                Action
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredRecords.map((record) => (
                            <tr key={record.id} className="border-t border-[rgba(0,0,0,0.1)] hover:bg-[#f9fafb]">
                                <td className="px-6 py-4 font-['Arimo:Regular',sans-serif] text-[14px] text-[#101828]">
                                    {record.date}
                                </td>
                                <td className="px-6 py-4 font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">
                                    {record.petName}
                                </td>
                                <td className="px-6 py-4 font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                    {record.owner}
                                </td>
                                <td className="px-6 py-4 font-['Arimo:Regular',sans-serif] text-[14px] text-[#101828]">
                                    {record.diagnosis}
                                </td>

                                <td className="px-6 py-4 font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                                    {record.followUp || 'None'}
                                </td>
                                <td className="px-6 py-4">
                                    <Button
                                        onClick={() => {
                                            // Navigate to diagnosis page with pre-filled record data
                                            const queryParams = new URLSearchParams({
                                                pet: record.petName,
                                                owner: record.owner,
                                                edit: 'true',
                                                recordId: record.id,
                                                diagnosis: record.diagnosis,
                                                treatment: record.treatment,
                                                medications: record.medications,
                                                notes: record.notes,
                                                followUp: record.followUp || ''
                                            });
                                            navigate(`/vet/diagnosis?${queryParams.toString()}`);
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                    >
                                        <Edit className="size-4 mr-1" />
                                        Edit
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>

                    {filteredRecords.length === 0 && (
                        <div className="px-6 py-12 text-center">
                            <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                                No medical records found
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit/Add Record Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-[700px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px] text-[#101828]">
                            {isEditing ? 'Edit Medical Record' : 'Add Medical Record'}
                        </DialogTitle>
                        <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                            {isEditing ? 'Update the details of the medical record.' : 'Enter the details of the new medical record.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                    Pet Name
                                </Label>
                                <Input
                                    value={formData.petName || ''}
                                    onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                                    className="h-10"
                                    placeholder="Enter pet name"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                    Owner Name
                                </Label>
                                <Input
                                    value={formData.owner || ''}
                                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                                    className="h-10"
                                    placeholder="Enter owner name"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                Date
                            </Label>
                            <Input
                                type="date"
                                value={formData.date || ''}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="h-10"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                Diagnosis
                            </Label>
                            <Textarea
                                value={formData.diagnosis || ''}
                                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                                className="min-h-[80px]"
                                placeholder="Enter diagnosis details"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                Treatment
                            </Label>
                            <Textarea
                                value={formData.treatment || ''}
                                onChange={(e) => setFormData({ ...formData, treatment: e.target.value })}
                                className="min-h-[80px]"
                                placeholder="Enter treatment details"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                Medications
                            </Label>
                            <Textarea
                                value={formData.medications || ''}
                                onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                                className="min-h-[80px]"
                                placeholder="Enter prescribed medications"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                Notes
                            </Label>
                            <Textarea
                                value={formData.notes || ''}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="min-h-[80px]"
                                placeholder="Additional notes"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#101828]">
                                Follow-up Date (Optional)
                            </Label>
                            <Input
                                type="date"
                                value={formData.followUp || ''}
                                onChange={(e) => setFormData({ ...formData, followUp: e.target.value })}
                                className="h-10"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            className="h-10"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveRecord}
                            className="bg-[#155dfc] hover:bg-[#0d4acf] h-10"
                        >
                            {isEditing ? 'Save Changes' : 'Add Record'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}