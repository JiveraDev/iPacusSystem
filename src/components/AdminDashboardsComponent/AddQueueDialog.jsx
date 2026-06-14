import { useMemo, useState, useEffect, useRef } from 'react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Label } from '../../ui/label';
import { Checkbox } from '../../ui/checkbox';
import { toast } from '../../reusecomponent/toast.jsx';
import SubmissionStatus from '../shared/SubmissionStatus';
import { addQueueItem, fetchQueuePets } from '../../services/queueService';

const SERVICES = [
    "Consultation", "Vaccination", "Grooming", "Dental", "General Check-Up", 
    "Surgery", "Kapon", "Lab-testing", "Parasite-control", "Boarding", "Home-service", "Special Services"
];

export default function AddQueueDialog({ onAddToQueue }) {
    const [allPets, setAllPets] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPet, setSelectedPet] = useState(null);
    const [service, setService] = useState('');
    const [priority, setPriority] = useState('normal');
    const [complaint, setComplaint] = useState('');
    const [verified, setVerified] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        fetchQueuePets()
            .then(data => setAllPets(Array.isArray(data) ? data : []))
            .catch(err => {
                console.error("Error loading pets:", err);
                setAllPets([]);
            });
    }, []);

    const suggestions = useMemo(() => {
        if (searchTerm.length < 2 || !Array.isArray(allPets)) {
            return [];
        }

        return allPets.filter((pet) =>
            pet.pet_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, allPets]);

    const handleSelectPet = (pet) => {
        setSelectedPet(pet);
        setSearchTerm(pet.pet_name);
        setIsMenuOpen(false);
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        if (!selectedPet || !service || !verified) return;

        setIsSubmitting(true);
        try {
            await addQueueItem({
                pet_id: selectedPet.pet_id,
                user_id: selectedPet.user_id,
                service_name: service,
                priority,
                complaint,
                queue_source: 'admin'
            });
            onAddToQueue();
            setIsOpen(false);
            setSelectedPet(null);
            setSearchTerm('');
            setService('');
            setPriority('normal');
            setComplaint('');
            setVerified(false);
            toast.success('Queue item added successfully');
            return;
        } catch (error) {
            toast.error(error.message || 'Failed to add queue item');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(nextOpen) => !isSubmitting && setIsOpen(nextOpen)}>
            <DialogTrigger asChild>
                <Button className="w-full bg-[#155dfc] sm:w-auto">Add to Queue</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Patient to Queue</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4 relative">
                    <div className="relative" ref={menuRef}>
                        <Label>Pet Name</Label>
                        <Input 
                            placeholder="Search pet..." 
                            value={searchTerm} 
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setIsMenuOpen(e.target.value.length >= 2);
                            }}
                            onFocus={() => searchTerm.length >= 2 && setIsMenuOpen(true)}
                            disabled={isSubmitting}
                        />
                        {isMenuOpen && suggestions.length > 0 && (
                            <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {suggestions.map(pet => (
                                    <button
                                        key={pet.pet_id}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                                        onClick={() => handleSelectPet(pet)}
                                    >
                                        {pet.pet_name} ({pet.owner_display || pet.owner_name})
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <Label>Owner Name</Label>
                        <Input value={selectedPet ? (selectedPet.owner_display || selectedPet.owner_name) : ''} disabled />
                    </div>

                    <div>
                        <Label>Service</Label>
                        <Select value={service} onValueChange={setService} disabled={isSubmitting}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Service" />
                            </SelectTrigger>
                            <SelectContent>
                                {SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Priority</Label>
                        <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Complaint</Label>
                        <Textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} disabled={isSubmitting} />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox id="verified" checked={verified} onCheckedChange={setVerified} disabled={isSubmitting} />
                        <Label htmlFor="verified">Admin verified content and location</Label>
                    </div>

                    <SubmissionStatus active={isSubmitting} label="Adding queue entry..." slowLabel="Still adding queue entry..." />
                </div>
                <Button onClick={handleSubmit} disabled={!verified || isSubmitting}>
                    {isSubmitting ? 'Adding to Queue...' : 'Add to Queue'}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
