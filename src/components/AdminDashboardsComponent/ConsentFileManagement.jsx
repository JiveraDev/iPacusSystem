import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Upload, FileText, Trash2, Edit3, Eye, Plus, AlertTriangle } from 'lucide-react';
import { toast } from '../../reusecomponent/toast.jsx';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import ConsentDocument from '../shared/ConsentDocument.jsx';
import FileUploadDropzone from '../shared/FileUploadDropzone.jsx';
import { PET_OWNER_CONSENT_CONTEXTS, parseConsentContexts } from '../../lib/consentAssignments';
import {
    createConsentFile,
    deleteConsentFile,
    fetchConsentFiles as fetchConsentFilesService,
    updateConsentFile
} from '../../services/consentFileService';

export default function ConsentFilesManagement() {
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    
    // Upload States
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadCategory, setUploadCategory] = useState('');
    const [uploadPetOwnerContexts, setUploadPetOwnerContexts] = useState([]);

    // Modal States
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileToDelete, setFileToDelete] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editPetOwnerContexts, setEditPetOwnerContexts] = useState([]);

    const categories = [
        { value: 'General Check-up', label: 'General Check-up' },
        { value: 'Vaccination', label: 'Vaccination' },
        { value: 'Surgery', label: 'Surgery' },
        { value: 'Dental Services', label: 'Dental Services' },
        { value: 'Pet Boarding', label: 'Pet Boarding' },
        { value: 'Laboratory Testing', label: 'Laboratory Testing' },
        { value: 'Emergency Care', label: 'Emergency Care' },
        { value: 'Parasite Control or Deworming', label: 'Parasite Control / Deworming' },
        { value: 'grooming', label: 'Grooming' },
        { value: 'surgery', label: 'Surgery (legacy)' },
        { value: 'dental', label: 'Dental Check-up (legacy)' },
        { value: 'kapon', label: 'Kapon / Special Surgery' },
        { value: 'parasite-control', label: 'Parasite Control' },
        { value: 'boarding', label: 'Pet Hotel & Boarding' },
        { value: 'consultation', label: 'Consultation' },
        { value: 'online-consultation', label: 'Online Consultation' },
        { value: 'home-service', label: 'Home Service' },
        { value: 'lab-testing', label: 'Lab Testing' }
    ];

    const categoryLabels = categories.reduce((labels, category) => ({
        ...labels,
        [category.value]: category.label
    }), {
        vaccination: 'Vaccination'
    });

    const fetchConsentFiles = async ({ isAutoRefresh = false } = {}) => {
        if (!isAutoRefresh) {
            setIsLoading(true);
        }
        try {
            const data = await fetchConsentFilesService();
            setFiles(data);
        } catch (error) {
            console.error("Error fetching consent files:", error);
            if (!isAutoRefresh) {
                toast.error("Failed to load consent forms");
            }
        } finally {
            setIsLoading(false);
        }
    };

    useAutoRefresh(fetchConsentFiles);

    const handleFileChange = (files) => {
        const file = Array.from(files || [])[0];
        if (file && !file.name.toLowerCase().endsWith('.txt')) {
            toast.error('Please upload only TXT files');
            return;
        }
        setUploadFile(file);
        setUploadTitle(file ? file.name.replace(/\.[^/.]+$/, '') : '');
    };

    const handleRemoveUploadFile = () => {
        setUploadFile(null);
        setUploadTitle('');
    };

    const handleUploadSubmit = async () => {
        if (!uploadFile) {
            toast.error("Please select a file first");
            return;
        }
        if (!uploadTitle.trim()) {
            toast.error("Please enter a document title");
            return;
        }
        if (!uploadCategory) {
            toast.error("Please select a category");
            return;
        }

        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target.result;
                
                const formData = new FormData();
                formData.append('file_name', uploadTitle.trim());
                formData.append('content', text);
                formData.append('file_size', formatFileSize(uploadFile.size));
                formData.append('category', uploadCategory);
                formData.append('pet_owner_contexts', JSON.stringify(uploadPetOwnerContexts.slice(0, 1)));

                await createConsentFile(formData);
                toast.success("Consent form added successfully");
                setUploadFile(null);
                setUploadTitle('');
                setUploadCategory('');
                setUploadPetOwnerContexts([]);
                const fileInput = document.getElementById('consent-file-input');
                if (fileInput) fileInput.value = '';
                fetchConsentFiles();
            };
            reader.readAsText(uploadFile);
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedFile) return;

        if (!editTitle.trim()) {
            toast.error("Document title is required");
            return;
        }
        
        try {
            await updateConsentFile(selectedFile.file_id, {
                file_name: editTitle.trim(),
                content: editContent,
                category: editCategory,
                pet_owner_contexts: JSON.stringify(editPetOwnerContexts.slice(0, 1))
            });
            toast.success("Consent form updated");
            setEditModalOpen(false);
            fetchConsentFiles();
        } catch {
            toast.error("Update failed");
        }
    };

    const confirmDelete = async () => {
        if (!fileToDelete) return;
        
        try {
            await deleteConsentFile(fileToDelete.file_id);
            toast.success("Form deleted successfully");
            setFiles(files.filter(f => f.file_id !== fileToDelete.file_id));
            setDeleteDialogOpen(false);
            setFileToDelete(null);
        } catch {
            toast.error("Error deleting form");
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828] mb-2">
                        Consent Files Management
                    </h2>
                    <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                        Official clinic consent templates and legal documents
                    </p>
                </div>
                <div className="bg-[#eff6ff] border border-[#bedbff] rounded-lg px-4 py-2 text-center">
                    <p className="text-[10px] uppercase font-bold text-[#4a5565] tracking-wider mb-1">Active Forms</p>
                    <p className="text-2xl font-bold text-[#155dfc]">{files.length}</p>
                </div>
            </div>

            {/* Upload Section */}
            <div className="rounded-[14px] border border-[rgba(0,0,0,0.1)] bg-white p-4 shadow-sm sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Upload className="size-5 text-blue-600" />
                    </div>
                    <h3 className="font-['Arimo:Bold',sans-serif] font-bold text-[18px] text-[#101828]">
                        Upload New Consent Template
                    </h3>
                </div>
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-gray-500 block">Select TXT File</Label>
                        <FileUploadDropzone
                            id="consent-file-input"
                            accept=".txt"
                            files={uploadFile ? [uploadFile] : []}
                            onFilesSelected={handleFileChange}
                            onRemove={handleRemoveUploadFile}
                            label="Click to upload TXT consent template"
                            helper="Selected document appears here before upload"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-gray-500 block">Document Title</Label>
                        <Input
                            value={uploadTitle}
                            onChange={(event) => setUploadTitle(event.target.value)}
                            placeholder="Consent document title"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-gray-500 block">Assign Category</Label>
                        <Select value={uploadCategory} onValueChange={setUploadCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select service category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-gray-500 block">Pet-owner readable assignment</Label>
                        <Select
                            value={uploadPetOwnerContexts[0] || 'none'}
                            onValueChange={(value) => setUploadPetOwnerContexts(value === 'none' ? [] : [value])}
                        >
                            <SelectTrigger>
                                <SelectValue
                                    displayValue={
                                        PET_OWNER_CONSENT_CONTEXTS.find((context) => context.value === uploadPetOwnerContexts[0])?.label || 'Not assigned'
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Not assigned</SelectItem>
                                {PET_OWNER_CONSENT_CONTEXTS.map((context) => (
                                    <SelectItem key={context.value} value={context.value}>{context.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button 
                        onClick={handleUploadSubmit}
                        disabled={isUploading || !uploadFile || !uploadTitle.trim() || !uploadCategory}
                        className="h-10 gap-2 bg-blue-600 font-bold hover:bg-blue-700 md:col-span-2 xl:col-span-4 xl:justify-self-end"
                    >
                        {isUploading ? "Uploading..." : (
                            <><Plus className="size-4" /> Add Consent</>
                        )}
                    </Button>
                </div>
            </div>

            {/* Files Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array(3).fill(0).map((_, i) => (
                        <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-xl" />
                    ))
                ) : files.map((file) => (
                    <Card key={file.file_id} className="group hover:border-blue-300 transition-all duration-300 hover:shadow-md border-gray-200 overflow-hidden">
                        <CardContent className="p-5">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div className="shrink-0 rounded-xl bg-[#eff6ff] p-3 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                                    <FileText className="size-7" />
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="size-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        onClick={() => {
                                            setSelectedFile(file);
                                            setEditTitle(file.file_name || '');
                                            setEditContent(file.content || '');
                                            setEditCategory(file.category || '');
                                            setEditPetOwnerContexts(parseConsentContexts(file.pet_owner_contexts || file.petOwnerContexts).slice(0, 1));
                                            setEditModalOpen(true);
                                        }}
                                    >
                                        <Edit3 className="size-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => {
                                            setFileToDelete(file);
                                            setDeleteDialogOpen(true);
                                        }}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </div>

                            <h4 className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828] mb-1 line-clamp-1">
                                {file.file_name}
                            </h4>
                            <div className="flex items-center gap-2 mb-4">
                                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 bg-slate-100 text-slate-600">
                                    {categoryLabels[file.category] || file.category}
                                </Badge>
                                <span className="text-[11px] text-gray-400">
                                    {file.file_size}
                                </span>
                            </div>
                            <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Pet-owner flows
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {parseConsentContexts(file.pet_owner_contexts || file.petOwnerContexts).slice(0, 1).length > 0 ? (
                                        parseConsentContexts(file.pet_owner_contexts || file.petOwnerContexts).slice(0, 1).map((context) => (
                                            <Badge key={context} className="border-0 bg-blue-100 text-[10px] font-bold text-blue-700">
                                                {PET_OWNER_CONSENT_CONTEXTS.find((item) => item.value === context)?.label || context}
                                            </Badge>
                                        ))
                                    ) : (
                                        <span className="text-xs font-medium text-slate-400">Not assigned</span>
                                    )}
                                </div>
                            </div>

                            <Button 
                                variant="outline" 
                                className="w-full border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-blue-500 hover:border-blue-600 transition-all font-bold text-xs gap-2"
                                onClick={() => {
                                    setSelectedFile(file);
                                    setViewModalOpen(true);
                                }}
                            >
                                <Eye className="size-4" />
                                VIEW DOCUMENT
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Empty State */}
            {!isLoading && files.length === 0 && (
                <div className="py-20 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <FileText className="size-12 text-gray-300 mx-auto mb-4" />
                    <p className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-1">No Consent Templates</p>
                    <p className="text-gray-400 text-sm">Upload a .txt form and assign it to a category.</p>
                </div>
            )}

            {/* View Modal */}
            <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden bg-slate-50 border-none shadow-2xl">
                    <div className="overflow-y-auto p-4 sm:p-8">
                        {selectedFile && (
                            <ConsentDocument title={selectedFile.file_name} content={selectedFile.content} />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Edit Consent Template</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Document Title</Label>
                            <Input
                                value={editTitle}
                                onChange={(event) => setEditTitle(event.target.value)}
                                placeholder="Consent document title"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Document Category</Label>
                            <Select value={editCategory} onValueChange={setEditCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Pet-owner readable assignment</Label>
                            <Select
                                value={editPetOwnerContexts[0] || 'none'}
                                onValueChange={(value) => setEditPetOwnerContexts(value === 'none' ? [] : [value])}
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        displayValue={
                                            PET_OWNER_CONSENT_CONTEXTS.find((context) => context.value === editPetOwnerContexts[0])?.label || 'Not assigned'
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Not assigned</SelectItem>
                                    {PET_OWNER_CONSENT_CONTEXTS.map((context) => (
                                        <SelectItem key={context.value} value={context.value}>{context.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Document Content</Label>
                            <Textarea 
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={12}
                                className="font-mono text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="size-5" />
                            Confirm Deletion
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-[#4a5565] text-sm leading-relaxed">
                            Are you sure you want to delete <span className="font-bold text-[#101828]">"{fileToDelete?.file_name}"</span>? 
                            This will permanently remove the template from the system.
                        </p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 font-bold">
                            Delete Form
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

const Label = ({ children, className }) => (
    <label className={`text-sm font-medium leading-none ${className}`}>{children}</label>
);
