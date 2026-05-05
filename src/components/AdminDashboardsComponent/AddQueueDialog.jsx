import { useState } from 'react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

export default function AddQueueDialog({ onAddToQueue }) {
    const [petName, setPetName] = useState('');
    const [owner, setOwner] = useState('');
    const [service, setService] = useState('');
    const [priority, setPriority] = useState('normal');
    const [complaint, setComplaint] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const handleSubmit = () => {
        onAddToQueue({ name: petName, owner }, service, priority, complaint);
        setIsOpen(false);
        setPetName('');
        setOwner('');
        setService('');
        setPriority('normal');
        setComplaint('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[#155dfc]">Add to Queue</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Patient to Queue</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Input placeholder="Pet Name" value={petName} onChange={(e) => setPetName(e.target.value)} />
                    <Input placeholder="Owner Name" value={owner} onChange={(e) => setOwner(e.target.value)} />
                    <Input placeholder="Service" value={service} onChange={(e) => setService(e.target.value)} />
                    <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger>
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input placeholder="Complaint" value={complaint} onChange={(e) => setComplaint(e.target.value)} />
                </div>
                <Button onClick={handleSubmit}>Add to Queue</Button>
            </DialogContent>
        </Dialog>
    );
}
