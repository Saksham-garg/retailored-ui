/* eslint-disable @next/next/no-img-element */
'use client';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Divider } from 'primereact/divider';
import { Dialog } from 'primereact/dialog';
import { RadioButton } from 'primereact/radiobutton';
import { InputTextarea } from 'primereact/inputtextarea';
import { Calendar } from 'primereact/calendar';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';
import { Galleria } from 'primereact/galleria';
import { Sidebar } from 'primereact/sidebar';
import { useState, useEffect, useRef } from 'react';
import FullPageLoader from '@/demo/components/FullPageLoader';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { SalesOrderService } from '@/demo/service/sales-order.service';
import { useInfiniteObserver } from '@/demo/hooks/useInfiniteObserver';
import { compressImage } from '@/demo/utils/imageCompressUtils';
import { Toast } from '@capacitor/toast';

interface Customer {
    id: string;
    fname: string;
    lname: string;
    mobileNumber: string;
    admsite_code: string;
}

interface Material {
    id: string;
    name: string;
    img_url: string | null;
    wsp: number;
    mrp: number;
}

interface ExtendedMaterial extends Material {
    displayPrice: number;
}

interface SelectedGarmentEntry {
    garment: Material;
    instanceId: string;
}

interface MeasurementMaster {
    id: string;
    measurement_name: string;
    data_type: string;
    seq: number;
    measurementDetail: {
      id: string;
      measurement_main_id: string;
      measurement_master_id: string;
      measurement_val: string;
    };
}

interface MeasurementEntry {
  val: string | null;
  master_id: string;
}

interface MeasurementValues {
    [instanceId: string]: {
      [measurement_name: string]: MeasurementEntry;
    };
}

interface AdditionalCost {
    id: string;
    description: string;
    amount: number;
}

interface ItemData {
  type: string;
  specialInstructions: string;
  deliveryDate: Date | null;
  trialDate: Date | null;
  isPriority: boolean;
  stitchingPrice: number;
  inspiration: string;
  uploadedImages: string[];
  additionalCosts: AdditionalCost[];
}

interface StitchOptions {
    collar?: string;
    sleeve?: string;
    bottom?: string;
    pocket?: string;
    pocketSquare?: string;
    cuffs?: string;
}

const CreateOrder = () => {
    const router = useRouter();
    const [visible, setVisible] = useState(false);
    const [selectedGarments, setSelectedGarments] = useState<SelectedGarmentEntry[]>([]);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [currentGarment, setCurrentGarment] = useState<Material | null>(null);
    const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(null);
    const [type, setType] = useState('stitching');
    const [isMaximized, setIsMaximized] = useState(true);
    const [currentMeasurements, setCurrentMeasurements] = useState<{[key: string]: MeasurementEntry}>({});
    const [allMeasurements, setAllMeasurements] = useState<MeasurementValues>({});
    const [isMesurementSaved, setIsMesurementSaved] = useState<{[instanceId: string]: boolean}>({});
    const [showStitchOptionsDialog, setShowStitchOptionsDialog] = useState(false);
    const [stitchOptions, setStitchOptions] = useState<{[instanceId: string]: StitchOptions}>({});
    const [garmentTotals, setGarmentTotals] = useState<{[instanceId: string]: number}>({});
    const [itemsData, setItemsData] = useState<{[instanceId: string]: ItemData}>({});
    const [visibleGalleria, setVisibleGalleria] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [imageUploadRef, setImageUploadRef] = useState<HTMLInputElement | null>(null);
    const [collarOption, setCollarOption] = useState<string | null>(null);
    const [sleeveOption, setSleeveOption] = useState<string | null>(null);
    const [bottomOption, setBottomOption] = useState<string | null>(null);
    const [pocketOption, setPocketOption] = useState('');
    const [pocketSquareOption, setPocketSquareOption] = useState('');
    const [cuffsOption, setCuffsOption] = useState('');
    const [showCustomerDialog, setShowCustomerDialog] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showImageSourceDialog, setShowImageSourceDialog] = useState(false);
    const [showAddCostDialog, setShowAddCostDialog] = useState(false);
    const [newCostDescription, setNewCostDescription] = useState('');
    const [newCostAmount, setNewCostAmount] = useState<number | null>(null);
    const [showOutfitSelectionDialog, setShowOutfitSelectionDialog] = useState(false);
    const [measurementData, setMeasurementData] = useState<MeasurementMaster[]>([]);
    const [hasMeasurementEntered, setHasMeasurementEntered] = useState(false);
    const [isLoadingMeasurements, setIsLoadingMeasurements] = useState(false);
    const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
    const [customerPage, setCustomerPage] = useState(1);
    const [materials, setMaterials] = useState<ExtendedMaterial[]>([]);
    const [materialSearch, setMaterialSearch] = useState('');
    const [materialPage, setMaterialPage] = useState(1);
    const [garmentRefNames, setGarmentRefNames] = useState<{[instanceId: string]: string}>({});
    const [editingRefName, setEditingRefName] = useState<{[instanceId: string]: boolean}>({});
    const [customerPagination, setCustomerPagination] = useState({ hasMorePages: true, currentPage: 1, total: 0 });
    const [materialPagination, setMaterialPagination] = useState({ hasMorePages: true, currentPage: 1, total: 0 });
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
    const [isAddingMeasurements, setIsAddingMeasurements] = useState(false);
    const [isConfirmingOrder, setIsConfirmingOrder] = useState(false);
    const materialObserverTarget = useRef<HTMLDivElement>(null);
    const materialSearchTimeout = useRef<NodeJS.Timeout>();
    const observerTarget = useRef<HTMLDivElement>(null);
    const searchTimeout = useRef<NodeJS.Timeout>();
    const priceInputRef = useRef(null);

    const getMaterialPrice = (material: Material, type: 'stitching' | 'alteration' = 'stitching'): number => {
        const priceItem = (material as any).priceChart?.find(
            (item: any) => item.type?.type_name === (type === 'stitching' ? 'Stitching' : 'Alteration')
        );
        
        return priceItem?.price || material.mrp || 0;
    };

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    useEffect(() => {
        if (currentInstanceId) {
            const itemData = itemsData[currentInstanceId] || {};
            const total = (itemData.stitchingPrice || 0) + 
                        ((itemData.additionalCosts || []).reduce((sum, cost) => sum + (cost.amount || 0), 0));
            
            setGarmentTotals(prev => ({
                ...prev,
                [currentInstanceId]: total
            }));
        }
    }, [currentInstanceId, itemsData]);

    const fetchCustomers = async (searchTerm = '', page = 1) => {
        setIsLoadingCustomers(true);
        try {
          const { data, pagination } = await SalesOrderService.getActiveCustomers(
            page,
            20,
            searchTerm || null
         );

          if (page === 1) {
            setAllCustomers(data);
          } else {
            setAllCustomers(prev => [...prev, ...data]);
          }
        
          setCustomerPagination({
            hasMorePages: pagination.hasMorePages,
            currentPage: pagination.currentPage,
            total: pagination.total
          });
        } catch (error) {
          console.error('Error fetching customers:', error);
          await Toast.show({
            text: 'Failed to load customers',
            duration: 'short',
            position: 'top'
          });
        } finally {
          setIsLoadingCustomers(false);
        }
    };
      
    useEffect(() => {
        fetchCustomers(customerSearch);
    }, []);

    const fetchMaterials = async (searchTerm = '', page = 1) => {
        setIsLoadingMaterials(true);
        try {
            const response = await SalesOrderService.getActiveMaterials(
                page,
                10,
                searchTerm || null
            );
            
            const materialsData: ExtendedMaterial[] = response.data.map((material: Material) => ({
                ...material,
                displayPrice: getMaterialPrice(material)
            }));
            const pagination = response.pagination;
    
            if (page === 1) {
                setMaterials(materialsData);
            } else {
                setMaterials(prev => [...prev, ...materialsData]);
            }
    
            setMaterialPagination({
                hasMorePages: pagination.hasMorePages,
                currentPage: pagination.currentPage,
                total: pagination.total
            });
        } catch (error) {
            console.error('Error fetching materials:', error);
            await Toast.show({
                text: 'Failed to load materials',
                duration: 'short',
                position: 'top'
            });
        } finally {
            setIsLoadingMaterials(false);
        }
    };

    useEffect(() => {
        fetchMaterials('', 1);
    }, []);

    const fetchMeasurementData = async (materialId: string): Promise<MeasurementMaster[]> => {
        if (!selectedCustomer) return [];
        
        setIsLoadingMeasurements(true);
        setIsAddingMeasurements(true);
        try {
          const measurements = await SalesOrderService.getMeasurementData(
            selectedCustomer.id,
            materialId
          );
          setMeasurementData(measurements);
          return measurements;
        } catch (error) {
          console.error('Error fetching measurements:', error);
          await Toast.show({
            text: 'Failed to load measurements',
            duration: 'short',
            position: 'top'
          });
          return [];
        } finally {
          setIsLoadingMeasurements(false);
          setIsAddingMeasurements(false);
        }
    };

    useInfiniteObserver({
        targetRef: observerTarget,
        hasMorePages: customerPagination.hasMorePages,
        isLoading: isLoadingCustomers,
        onIntersect: () => {
            fetchCustomers(customerSearch, customerPage + 1);
            setCustomerPage(prev => prev + 1);
        },
        deps: [customerPage, customerSearch],
    });
    
    useInfiniteObserver({
        targetRef: materialObserverTarget,
        hasMorePages: materialPagination.hasMorePages,
        isLoading: isLoadingMaterials,
        onIntersect: () => {
            fetchMaterials(materialSearch, materialPage + 1);
            setMaterialPage(prev => prev + 1);
        },
        deps: [materialPage, materialSearch],
    });    

    const handleCustomerSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCustomerSearch(value);
        
        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }
        
        searchTimeout.current = setTimeout(() => {
            fetchCustomers(value, 1);
            setCustomerPage(1);
        }, 500);
    };

    const handleMaterialSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setMaterialSearch(value);
    
        if (materialSearchTimeout.current) {
            clearTimeout(materialSearchTimeout.current);
        }
    
        materialSearchTimeout.current = setTimeout(() => {
            fetchMaterials(value, 1);
            setMaterialPage(1);
        }, 500);
    };    

    const getCustomerFullName = (customer: Customer) => {
        if (!customer.lname) {
          return customer.fname;
        }
        return `${customer.fname} ${customer.lname}`;
    };

    const generateInstanceId = (garment: Material, index?: number) => {
        const uniqueId = `${garment.id}-${Date.now()}`;
        return uniqueId;
    };

    const ensureInstanceDataInitialized = (instanceId: string, garment: Material, currentSelectedCustomer: Customer | null) => {
        if (!itemsData[instanceId]) {
            const selectedType = 'stitching';
            const initialStitchingPrice = getMaterialPrice(garment, selectedType);

            setItemsData(prev => ({
                ...prev,
                [instanceId]: {
                    type: selectedType,
                    specialInstructions: '',
                    deliveryDate: null,
                    trialDate: null,
                    isPriority: false,
                    stitchingPrice: initialStitchingPrice,
                    inspiration: '',
                    uploadedImages: [],
                    additionalCosts: []
                }
            }));
        } else {
            setType(itemsData[instanceId].type);
        }
        
        if (currentSelectedCustomer && !garmentRefNames[instanceId]) {
            setGarmentRefNames(prev => ({
                ...prev,
                [instanceId]: currentSelectedCustomer.fname
            }));
        }
    };
 
    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setShowCustomerDialog(false);
        setCustomerSearch('');
    };

    const handleClearCustomer = () => {
        setSelectedCustomer(null);
    };

    const handleRefNameChange = (garmentId: string, newName: string) => {
        setGarmentRefNames(prev => ({
            ...prev,
            [garmentId]: newName
        }));
    };

    const toggleEditRefName = (garmentId: string) => {
        setEditingRefName(prev => ({
            ...prev,
            [garmentId]: !prev[garmentId]
        }));
    };

    const handleCloneGarment = (garmentToClone: Material, originalInstanceId: string) => {
        const newInstanceId = generateInstanceId(garmentToClone, selectedGarments.length);

        setSelectedGarments(prev => [...prev, { garment: garmentToClone, instanceId: newInstanceId }]);

        const originalItemData = itemsData[originalInstanceId];
        if (originalItemData) {
            setItemsData(prev => ({ ...prev, [newInstanceId]: { ...originalItemData } }));
        }

        const originalMeasurements = allMeasurements[originalInstanceId];
        if (originalMeasurements) {
            setAllMeasurements(prev => ({ ...prev, [newInstanceId]: { ...originalMeasurements } }));
            setIsMesurementSaved(prev => ({ ...prev, [newInstanceId]: true }));
        }

        const originalStitchOptions = stitchOptions[originalInstanceId];
        if (originalStitchOptions) {
            setStitchOptions(prev => ({ ...prev, [newInstanceId]: { ...originalStitchOptions } }));
        }

        const originalRefName = garmentRefNames[originalInstanceId];
        if (originalRefName) {
            setGarmentRefNames(prev => ({ ...prev, [newInstanceId]: originalRefName }));
        }
        
        const originalTotal = garmentTotals[originalInstanceId];
        if (originalTotal) {
            setGarmentTotals(prev => ({ ...prev, [newInstanceId]: originalTotal }));
        }
    };

    const handleOutfitSelection = (garment: Material) => {
        const existingCount = selectedGarments.filter(sg => sg.garment.id === garment.id).length;
        const instanceId = generateInstanceId(garment, existingCount);
        
        setSelectedGarments(prev => [...prev, { garment, instanceId }]);
        
        setShowOutfitSelectionDialog(false);
        setCurrentGarment(garment);
        setCurrentInstanceId(instanceId);
        
        ensureInstanceDataInitialized(instanceId, garment, selectedCustomer);

        if (itemsData[instanceId]) {
            setType(itemsData[instanceId].type);
        } else {
            setType('stitching');
        }
        
        setShowCreateDialog(true);
    };

    const openMeasurementDialog = async (garmentForDialog: Material, instanceIdForDialog: string) => {
        setCurrentGarment(garmentForDialog);
        setCurrentInstanceId(instanceIdForDialog);
        setHasMeasurementEntered(false);
    
        if (!selectedCustomer) return;
    
        if (!garmentRefNames[instanceIdForDialog] && selectedCustomer) {
            setGarmentRefNames(prev => ({
                ...prev,
                [instanceIdForDialog]: selectedCustomer.fname
            }));
        }
    
        const garmentSpecificMasters = await fetchMeasurementData(garmentForDialog.id);
    
        const existingMeasurementsForInstance = allMeasurements[instanceIdForDialog] || {};
        const initialDialogMeasurements: { [key: string]: MeasurementEntry } = {};

        garmentSpecificMasters.forEach(master => {
            const existingEntry = existingMeasurementsForInstance[master.measurement_name];
            if (existingEntry) {
                initialDialogMeasurements[master.measurement_name] = {
                    val: existingEntry.val,
                    master_id: existingEntry.master_id
                };
            } else {
                initialDialogMeasurements[master.measurement_name] = {
                    val: master.measurementDetail?.measurement_val || '',
                    master_id: master.id
                };
            }
        });
        setMeasurementData(garmentSpecificMasters);
        setCurrentMeasurements(initialDialogMeasurements);
        setVisible(true);
    };

    const handleMeasurementChange = (measurementName: string, value: string) => {
        setCurrentMeasurements(prev => {
            const existingEntry = prev[measurementName] || { val: null, master_id: '' };
            const newMeasurements = {
                ...prev,
                [measurementName]: { ...existingEntry, val: value }
            };
            
            const hasValue = Object.values(newMeasurements).some(entry => entry.val && entry.val.trim() !== '');
            setHasMeasurementEntered(hasValue);
            
            return newMeasurements;
        });
    };

    const handleSaveMeasurements = () => {
        if (currentGarment && currentInstanceId) {
            const measurementsToSave: { [key: string]: MeasurementEntry } = {};
            Object.entries(currentMeasurements).forEach(([name, entry]) => {
                const master = measurementData.find(m => m.measurement_name === name);
                measurementsToSave[name] = {
                    val: entry.val,
                    master_id: master?.id || '0'
                };
            });

            setAllMeasurements(prev => ({
                ...prev,
                [currentInstanceId]: measurementsToSave
            }));
            
            setIsMesurementSaved(prev => ({
                ...prev,
                [currentInstanceId]: true
            }));
        }
        setVisible(false);
    };

    const handleSaveOrder = () => {
        setShowCreateDialog(false);
        resetDialog();
    };

    const resetDialog = () => {
        setType('stitching');
        setCurrentInstanceId(null);
    };

    const handleImageSourceSelect = async (source: 'camera' | 'gallery', instanceId?: string) => {
        const targetInstanceId = instanceId || currentInstanceId;
        
        if (!targetInstanceId) {
            await Toast.show({
                text: 'No item selected for image upload',
                duration: 'short',
                position: 'top'
            });
            return;
        }

        setShowImageSourceDialog(false);
        try {
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
            });

            if (image.webPath || image.path) {
                let imageUrl = image.webPath;
                
                if (!imageUrl && image.path) {
                    const file = await Filesystem.readFile({
                        path: image.path!,
                        directory: Directory.Cache,
                    });
                    imageUrl = `data:image/jpeg;base64,${file.data}`;
                }

                if (imageUrl) {
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    const file = new File([blob], 'captured.jpg', { type: blob.type });

                    const MAX_SIZE_MB = 1;
                    let finalFile = file;
                    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                        finalFile = await compressImage(file, MAX_SIZE_MB) || file;
                    }

                    if (finalFile.size > MAX_SIZE_MB * 1024 * 1024) {
                        await Toast.show({
                            text: 'Image is too large after compression',
                            duration: 'short',
                            position: 'top'
                        });
                        return;
                    }

                    setItemsData(prev => ({
                        ...prev,
                        [targetInstanceId]: {
                            ...prev[targetInstanceId],
                            uploadedImages: [...(prev[targetInstanceId]?.uploadedImages || []), URL.createObjectURL(finalFile)]
                        }
                    }));
                }
            }
        } catch (error) {
            console.error('Error capturing image:', error);
            await Toast.show({
                text: 'Failed to capture image',
                duration: 'short',
                position: 'top'
            });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, instanceId: string | null) => {
        if (!instanceId) {
            await Toast.show({
                text: 'No item selected for image upload',
                duration: 'short',
                position: 'top'
            });
            return;
        }

        if (e.target.files) {
            const files = Array.from(e.target.files);
            const MAX_SIZE_MB = 1;
            
            try {
                const compressedFiles = await Promise.all(
                    files.map(async (file) => {
                        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
                            const compressedFile = await compressImage(file, MAX_SIZE_MB);
                            if (!compressedFile) {
                                throw new Error('Compression failed');
                            }
                            return compressedFile;
                        }
                        return file;
                    })
                );

                const newImages = await Promise.all(
                    compressedFiles.map(async (file) => {
                        return URL.createObjectURL(file);
                    })
                );
                
                setItemsData(prev => ({
                    ...prev,
                    [instanceId]: {
                        ...prev[instanceId],
                        uploadedImages: [...(prev[instanceId]?.uploadedImages || []), ...newImages]
                    }
                }));
            } catch (error) {
                console.error('Error processing images:', error);
                await Toast.show({
                    text: 'Failed to process some images. Please try smaller files.',
                    duration: 'short',
                    position: 'top'
                });
            }
        }
    };
      
    const itemTemplate = (item: string) => {
        return (
            <img 
                src={item} 
                alt="Uploaded reference" 
                style={{ width: '100%', display: 'block' }}
            />
        );
    };
    
    const thumbnailTemplate = (item: string) => {
        return (
            <img 
                src={item} 
                alt="Uploaded reference thumbnail" 
                style={{ width: '100%', display: 'block' }}
            />
        );
    };

    const showToast = async (message: string) => {
        await Toast.show({ 
          text: message,
          duration: 'short',
          position: 'bottom'
        });
    };   

    const handleConfirmOrder = async () => {        
        try {
            setIsConfirmingOrder(true);
            if (!selectedCustomer) {
                await showToast('Please select a customer first');
                return;
            }
            
            if (selectedGarments.length === 0) {
                await showToast('Please add at least one outfit');
                return;
            }
        
            const formatDateTime = (date?: Date | null) => {
                if (!date) return '';
                const pad = (num: number) => num.toString().padStart(2, '0');
                return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
            };
        
            const currentDate = new Date();
            
            const orderDetails = await Promise.all(
                selectedGarments.map(async (sgEntry) => {
                    const { garment, instanceId } = sgEntry;
                    const itemData = itemsData[instanceId] || {};
                    
                    const base64Images = await Promise.all(
                        (itemData.uploadedImages || []).map(async (url) => {
                            const response = await fetch(url);
                            const blob = await response.blob();
                            return new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                            });
                        })
                    );
                    
                    return {
                        material_master_id: parseInt(garment.id),
                        image_url: base64Images,
                        item_amt: garmentTotals[instanceId] || 0,
                        item_discount: 0,
                        ord_qty: 1,
                        trial_date: formatDateTime(itemData.trialDate),
                        delivery_date: formatDateTime(itemData.deliveryDate),
                        item_ref: garmentRefNames[instanceId] || '',
                        admsite_code: parseInt(selectedCustomer.admsite_code) || 0,
                        status_id: 1,
                        type_id: itemData.type === 'stitching' ? 1 : 2,
                        desc1: itemData.specialInstructions || '',
                        desc2: itemData.inspiration || '',
                        measurement_main: [{
                            user_id: parseInt(selectedCustomer.id),
                            material_master_id: parseInt(garment.id),
                            measurement_date: formatDateTime(currentDate) || currentDate.toISOString().replace('T', ' ').substring(0, 19),
                            details: Object.entries(allMeasurements[instanceId] || {}).map(([key, measurementEntry]) => {
                                return {
                                    measurement_master_id: parseInt(measurementEntry.master_id || '0'),
                                    measurement_val: measurementEntry.val || ''
                                };
                            })
                        }]
                    };
                })
            );
            
            const orderPayload = {
                user_id: parseInt(selectedCustomer.id),
                order_date: formatDateTime(currentDate) || currentDate.toISOString().replace('T', ' ').substring(0, 19),
                status_id: 1,
                order_details: orderDetails
            };
                
            const response = await SalesOrderService.createOrderWithDetails(orderPayload);
            
            await showToast('Order confirmed successfully!');
            
            setSelectedCustomer(null);
            setSelectedGarments([]);
            setItemsData({});
            setGarmentTotals({});
            setGarmentRefNames({});
            setAllMeasurements({});
            setIsMesurementSaved({});
            setStitchOptions({});

            router.push('/pages/orders/sales-order');
            
            return response;
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to confirm order. Please try again.';
            await Toast.show({
                text: errorMessage,
                duration: 'short',
                position: 'bottom'
            });
            console.error('Error:', err);
        } finally {
            setIsConfirmingOrder(false);
        }
    };

    const dialogFooter = (
        <div className="mt-3">
            <Button label="Save" className="w-full" onClick={handleSaveOrder} autoFocus />
        </div>
    );

    const measurementFooter = (
        <div>
          <Button label="Cancel" icon="pi pi-times" onClick={() => setVisible(false)} className="p-button-text" />
          <Button label="Save" icon="pi pi-check" onClick={handleSaveMeasurements} autoFocus disabled={!hasMeasurementEntered} />
        </div>
    );

    const stitchFooter = (
        <div>
          <Button label="Cancel" icon="pi pi-times" onClick={() => setShowStitchOptionsDialog(false)} className="p-button-text" />
          <Button label="Save" icon="pi pi-check" onClick={() => {
              if (currentInstanceId) {
                  setStitchOptions(prev => ({
                      ...prev,
                      [currentInstanceId]: {
                          collar: collarOption || undefined,
                          sleeve: sleeveOption || undefined,
                          bottom: bottomOption || undefined,
                          pocket: pocketOption || undefined,
                          pocketSquare: pocketSquareOption || undefined,
                          cuffs: cuffsOption || undefined
                      }
                  }));
              }
              setShowStitchOptionsDialog(false);
          }} autoFocus />
        </div>
    );

    return (
        <div className="flex flex-column p-3 lg:p-0 mb-5" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {(isConfirmingOrder) && <FullPageLoader />}
            <h2 className="text-2xl m-0 mb-3">Create Order</h2>
            <Card className="mb-4">
                <div className="flex flex-column gap-1 surface-50 border-round">
                    {selectedCustomer ? (
                        <div className="flex flex-column">
                            <div className="flex justify-content-between align-items-center">
                                <div className="flex align-items-center gap-2">
                                    <i className="pi pi-user text-500"></i>
                                    <span className="font-bold">{getCustomerFullName(selectedCustomer)}</span>
                                </div>
                                <Button 
                                    icon="pi pi-times" 
                                    rounded 
                                    text 
                                    severity="secondary"
                                    tooltip="Change customer"
                                    tooltipOptions={{ position: 'top' }}
                                    onClick={handleClearCustomer}
                                />
                            </div>
                            <div className="flex align-items-center gap-2">
                                <i className="pi pi-phone text-500"></i>
                                <span>{selectedCustomer.mobileNumber}</span>
                            </div>
                        </div>
                    ) : (
                        <Button 
                            label="Select Customer" 
                            icon="pi pi-user-plus" 
                            className="p-button-outlined w-full" 
                            onClick={() => setShowCustomerDialog(true)}
                        />
                    )}
                </div>
            </Card>

            <Divider />

            <div className="main-selected-outfit mb-5">
                <div className="flex justify-content-between align-items-center mb-3">
                    <h3 className="text-lg m-0">Selected Outfits</h3>
                    <Button 
                        label="Add Outfit" 
                        icon="pi pi-plus" 
                        onClick={() => setShowOutfitSelectionDialog(true)}
                        size="small"
                        disabled={!selectedCustomer}
                    />
                </div>

                {selectedGarments.length > 0 ? (
                    <div className="grid">
                        {selectedGarments.map((sgEntry) => {
                            const { garment, instanceId } = sgEntry;
                            return (
                                <div key={instanceId} className="col-12 md:col-6 lg:col-4">
                                    <Card className="h-full">
                                        <div className="flex flex-column">
                                            <div className="flex justify-content-between align-items-center">
                                                <span className="font-medium">{garment.name}</span>
                                                <div className="flex">
                                                    <Button
                                                        icon="pi pi-copy"
                                                        rounded
                                                        text
                                                        severity="secondary"
                                                        onClick={() => handleCloneGarment(garment, instanceId)}
                                                    />
                                                    <Button
                                                        icon="pi pi-pencil"
                                                        rounded
                                                        text
                                                        severity="info"
                                                        onClick={() => {
                                                            setCurrentGarment(garment);
                                                            setCurrentInstanceId(instanceId);
                                                            ensureInstanceDataInitialized(instanceId, garment, selectedCustomer);
                                                            setType(itemsData[instanceId]?.type || 'stitching');
                                                            setShowCreateDialog(true);
                                                        }}
                                                    />
                                                    <Button
                                                        icon="pi pi-trash"
                                                        rounded
                                                        text
                                                        severity="danger"
                                                        onClick={() => {
                                                            setSelectedGarments(prevSg => prevSg.filter(item => item.instanceId !== instanceId));
                                                            setGarmentRefNames(prev => { const newState = {...prev}; delete newState[instanceId]; return newState; });
                                                            setAllMeasurements(prev => { const newState = {...prev}; delete newState[instanceId]; return newState; });
                                                            setIsMesurementSaved(prev => { const newState = {...prev}; delete newState[instanceId]; return newState; });
                                                            setStitchOptions(prev => { const newState = {...prev}; delete newState[instanceId]; return newState; });
                                                            setItemsData(prev => { const newState = {...prev}; delete newState[instanceId]; return newState; });
                                                            setGarmentTotals(prev => { const newState = {...prev}; delete newState[instanceId]; return newState; });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            {selectedCustomer && (
                                                <small className="text-500">Ref: {garmentRefNames[instanceId] || ''}</small>
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-column align-items-center justify-content-center py-4 gap-3" style={{ minHeight: '25vh' }}>
                        <i className="pi pi-shopping-bag text-4xl text-400" style={{ fontSize: '2.5rem' }}></i>
                        <p className="text-500 font-medium text-xl">No outfits added</p>
                    </div>
                )}
            </div>

            <Sidebar 
                visible={showCustomerDialog}
                onHide={() => {
                    setShowCustomerDialog(false);
                    setCustomerSearch('');
                    setCustomerPage(1);
                }}
                position="bottom"
                style={{ 
                    width: '100vw',
                    height: '80vh',
                    maxHeight: '80vh',
                    borderTopLeftRadius: '12px',
                    borderTopRightRadius: '12px',
                    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)'
                }}
                className="custom-selector-sidebar"
                header={
                    <div className="sticky top-0 bg-white z-1 p-2 surface-border flex justify-content-between align-items-center">
                        <span className="font-bold text-2xl">Select Customer</span>
                    </div>
                }
                blockScroll
            >
                <div className="flex flex-column h-full">
                    <div className="p-3 border-bottom-1 surface-border">
                          <span className="p-input-icon-left p-input-icon-right w-full">
                            <i className="pi pi-search" />
                            <InputText
                                value={customerSearch}
                                onChange={handleCustomerSearch}
                                placeholder="Search"
                                className="w-full"
                            />
                            {customerSearch && (
                                <i 
                                    className="pi pi-times cursor-pointer" 
                                    onClick={() => {
                                    setCustomerSearch('');
                                    fetchCustomers('', 1);
                                    }}
                                />
                            )}
                        </span>
                    </div>

                    <div className="flex-grow-1 overflow-y-auto">
                        {allCustomers.map(customer => (
                            <div 
                                key={customer.id} 
                                className={`p-3 border-bottom-1 surface-border cursor-pointer flex justify-content-between align-items-center ${
                                    selectedCustomer?.id === customer.id ? 'bg-blue-50' : 'hover:surface-50'
                                }`}
                                onClick={() => handleSelectCustomer({
                                    id: customer.id,
                                    fname: customer.fname,
                                    lname: customer.lname,
                                    mobileNumber: customer.mobileNumber,
                                    admsite_code: customer.admsite_code
                                })}
                            >
                                <div className="flex-1">
                                    <div className="font-medium">{getCustomerFullName(customer)}</div>
                                    <div className="text-sm text-500">{customer.mobileNumber}</div>
                                </div>
                                {selectedCustomer?.id === customer.id && (
                                    <i className="pi pi-check text-primary"></i>
                                )}
                            </div>
                        ))}

                        {isLoadingCustomers && (
                            <div className="p-3 flex justify-content-center">
                                <i className="pi pi-spinner pi-spin"></i>
                            </div>
                        )}

                        {!isLoadingCustomers && customerPagination.hasMorePages && (
                            <div ref={observerTarget} className="p-3 flex justify-content-center">
                                <i className="pi pi-spinner pi-spin"></i>
                            </div>
                        )}

                        {!isLoadingCustomers && allCustomers.length === 0 && (
                            <div className="p-5 text-center text-500">
                                No customers found
                            </div>
                        )}

                        {!isLoadingCustomers && allCustomers.length > 0 && customerSearch && 
                            allCustomers.filter(c => 
                                getCustomerFullName(c).toLowerCase().includes(customerSearch.toLowerCase()) || 
                                c.mobileNumber.includes(customerSearch)
                            ).length === 0 && (
                            <div className="p-5 text-center text-500">
                                No matching customers found
                            </div>
                        )}
                    </div>
                </div>
            </Sidebar>

            <Sidebar
                visible={showOutfitSelectionDialog}
                onHide={() => setShowOutfitSelectionDialog(false)}
                position="bottom"
                style={{ 
                    width: '100vw',
                    height: '68vh',
                    maxHeight: '68vh',
                    borderTopLeftRadius: '12px',
                    borderTopRightRadius: '12px',
                    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)'
                }}
                className="custom-selector-sidebar"
                header={
                    <div className="sticky top-0 bg-white z-1 p-2 surface-border flex justify-content-between align-items-center">
                        <span className="font-bold text-2xl">Select Outfits</span>
                    </div>
                }
                blockScroll
                >
                <div className="flex flex-column h-full">
                    <div className="p-3 border-bottom-1 surface-border">
                        <span className="p-input-icon-left p-input-icon-right w-full">
                            <i className="pi pi-search" />
                            <InputText
                                value={materialSearch}
                                onChange={handleMaterialSearch}
                                placeholder="Search"
                                className="w-full"
                            />

                            {materialSearch && (
                                <i 
                                    className="pi pi-times cursor-pointer" 
                                    onClick={() => {
                                    setMaterialSearch('');
                                    fetchMaterials('', 1);
                                    }}
                                />
                            )}
                        </span>
                    </div>

                    <div className="flex flex-column" style={{ overflowY: 'auto' }}>
                        {materials.map((material) => (
                            <div 
                                key={material.id}
                                className="flex justify-content-between align-items-center p-3 border-bottom-1 surface-border cursor-pointer hover:surface-100 transition-duration-150"
                                onClick={() => handleOutfitSelection(material)}
                            >
                                <div>
                                    <span className="font-medium text-900">{material.name}</span>
                                    <div className="text-sm text-500">₹{material.displayPrice.toLocaleString('en-IN')}</div>
                                </div>
                                <i className="pi pi-plus-circle text-2xl" />
                            </div>
                        ))}
                        
                        {materials.length === 0 && (
                        <div className="p-5 text-center text-500">
                            No outfits available
                        </div>
                        )}
                    </div>
                </div>
            </Sidebar>

            <Dialog
                header='Create Order'
                visible={showCreateDialog}
                onHide={() => {
                    setShowCreateDialog(false);
                    resetDialog();
                    setEditingRefName({});
                }}
                maximized={isMaximized}
                onMaximize={(e) => setIsMaximized(e.maximized)}
                className={isMaximized ? 'maximized-dialog' : ''}
                blockScroll
                footer={dialogFooter}
            >
                <div className="p-fluid">
                     <div className="field my-4">
                        <div className="flex justify-content-between align-items-center">
                            <h4 className="m-0 text-900 font-medium">{currentGarment?.name}</h4>
                            {currentGarment && currentInstanceId && (
                                <div className="flex align-items-center gap-2">
                                    {editingRefName[currentInstanceId] ? (
                                        <>
                                            <small className="text-500">Ref:</small>
                                            <InputText 
                                                value={garmentRefNames[currentInstanceId] || ''}
                                                onChange={(e) => handleRefNameChange(currentInstanceId, e.target.value)}
                                                className="p-inputtext-sm"
                                                style={{ width: '100px' }}
                                                autoFocus
                                            />
                                            <Button 
                                                icon="pi pi-check" 
                                                rounded 
                                                text 
                                                className="p-button-sm p-button-success"
                                                onClick={() => toggleEditRefName(currentInstanceId)}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <small className="text-500">Ref: {garmentRefNames[currentInstanceId] || ''}</small>
                                            <Button 
                                                icon="pi pi-pencil" 
                                                rounded 
                                                text 
                                                className="p-button-sm"
                                                onClick={() => toggleEditRefName(currentInstanceId)}
                                            />
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="field mb-4">
                        <label>Type</label>
                        <div className="flex gap-3 mt-2">
                            <div className="flex align-items-center">
                                <RadioButton 
                                    inputId="stitching" 
                                    name="type" 
                                    value="stitching" 
                                    onChange={(e) => {
                                        setType(e.value);
                                        if (currentGarment && currentInstanceId) {
                                            const stitchingPrice = getMaterialPrice(currentGarment, 'stitching');
                                            setItemsData(prev => ({
                                                ...prev,
                                                [currentInstanceId]: {
                                                    ...prev[currentInstanceId],
                                                    type: e.value,
                                                    stitchingPrice: stitchingPrice
                                                }
                                            }));
                                        }
                                    }}
                                    checked={type === 'stitching'}
                                />
                                <label htmlFor="stitching" className="ml-2">Stitching</label>
                            </div>
                            <div className="flex align-items-center">
                                <RadioButton 
                                    inputId="alteration"
                                    name="type" 
                                    value="alteration" 
                                    onChange={(e) => {
                                        setType(e.value);
                                        if (currentGarment && currentInstanceId) {
                                            const alterationPrice = getMaterialPrice(currentGarment, 'alteration');
                                            setItemsData(prev => ({
                                                ...prev,
                                                [currentInstanceId]: {
                                                    ...prev[currentInstanceId],
                                                    type: e.value,
                                                    stitchingPrice: alterationPrice
                                                }
                                            }));
                                        }
                                    }}
                                    checked={type === 'alteration'}
                                />
                                <label htmlFor="alteration" className="ml-2">Alteration</label>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-column gap-3 mb-4">
                        <div className="flex flex-column gap-2">
                            <div className="flex align-items-center">
                                <span className="font-medium w-9">Add Measurements</span>
                                <div className="w-3 text-right">
                                    {currentInstanceId && isMesurementSaved[currentInstanceId] ? (
                                        <Button
                                            label="Edit"
                                            icon={isAddingMeasurements ? "pi pi-spinner pi-spin" : "pi pi-pencil"}
                                            onClick={() => {
                                                if (currentGarment && currentInstanceId) {
                                                    openMeasurementDialog(currentGarment, currentInstanceId);
                                                }
                                            }}
                                            className="p-button-sm p-button-outlined"
                                            disabled={isAddingMeasurements}
                                        />
                                    ) : (
                                        <Button
                                            label="Add"
                                            icon={isAddingMeasurements ? "pi pi-spinner pi-spin" : "pi pi-plus"}
                                            onClick={() => {
                                                if (currentGarment && currentInstanceId) {
                                                    openMeasurementDialog(currentGarment, currentInstanceId);
                                                }
                                            }}
                                            className="p-button-sm p-button-outlined"
                                            disabled={isAddingMeasurements}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-column gap-2">
                            <div className="flex align-items-center">
                                <span className="font-medium w-9">Stitch Options</span>
                                <div className="w-3 text-right">
                                    <Button 
                                        label="Add" 
                                        icon="pi pi-plus" 
                                        onClick={() => {
                                            if (currentInstanceId) {
                                                const currentOptions = stitchOptions[currentInstanceId] || {};
                                                setCollarOption(currentOptions.collar || null);
                                                setSleeveOption(currentOptions.sleeve || null);
                                                setBottomOption(currentOptions.bottom || null);
                                                setPocketOption(currentOptions.pocket || '');
                                                setPocketSquareOption(currentOptions.pocketSquare || '');
                                                setCuffsOption(currentOptions.cuffs || '');
                                            }
                                            setShowStitchOptionsDialog(true);
                                        }}
                                        className="p-button-sm p-button-outlined"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="field mb-4">
                        <label htmlFor="instructions">Special Instructions</label>
                        <InputTextarea 
                            id="instructions" 
                            rows={3} 
                            value={currentInstanceId ? itemsData[currentInstanceId]?.specialInstructions || '' : ''}
                            onChange={(e) => {
                                if (currentInstanceId) {
                                    setItemsData(prev => ({
                                        ...prev,
                                        [currentInstanceId]: {
                                            ...prev[currentInstanceId],
                                            specialInstructions: e.target.value
                                        }
                                    }));
                                }
                            }}
                            placeholder="Write instructions..."
                            className="w-full"
                        />
                    </div>

                    <div className="flex flex-column gap-4 mb-4">
                        <Button
                            icon="pi pi-microphone"
                            label="Record Audio"
                            className="p-button-outlined w-7"
                            disabled
                        />
                        <div>
                            <input
                                type="file"
                                ref={ref => setImageUploadRef(ref)}
                                onChange={(e) => {
                                    if (currentInstanceId) {
                                        handleFileUpload(e, currentInstanceId);
                                    }
                                }}
                                multiple
                                accept="image/*"
                                style={{ display: 'none' }}
                            />
                            <Button
                                icon="pi pi-image"
                                label="Upload Image"
                                className="p-button-outlined w-7"
                                onClick={() => setShowImageSourceDialog(true)}
                            />
                            <p className="mt-1 text-sm text-500">
                                <small>Max 1MB per image (larger images will be compressed)</small>
                            </p>
                        </div>

                        {currentInstanceId && itemsData[currentInstanceId]?.uploadedImages?.length > 0 && (
                            <div className="flex overflow-x-auto pb-2" style={{ gap: '0.75rem' }}>
                                {itemsData[currentInstanceId].uploadedImages.map((image, index) => (
                                    <div key={index} className="relative flex-shrink-0" style={{ width: '120px' }}>
                                        <div className="border-1 surface-border border-round p-2 h-full">
                                            <img 
                                                src={image} 
                                                alt={`Uploaded ${index + 1}`} 
                                                className="w-full border-round cursor-pointer" 
                                                style={{ height: '80px', objectFit: 'cover' }}
                                                onClick={() => {
                                                    setActiveIndex(index);
                                                    setVisibleGalleria(true);
                                                }}
                                            />
                                            <Button
                                                icon="pi pi-trash"
                                                className="p-button-rounded p-button-danger p-button-text absolute"
                                                style={{ top: '4px', right: '4px', width: '1.5rem', height: '1.5rem' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (currentInstanceId) {
                                                        setItemsData(prev => ({
                                                            ...prev,
                                                            [currentInstanceId]: {
                                                                ...prev[currentInstanceId],
                                                                uploadedImages: prev[currentInstanceId].uploadedImages.filter((_, i) => i !== index)
                                                            }
                                                        }));
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="field mb-4">
                        <label htmlFor="inspiration">Add Inspiration</label>
                        <span className="p-input-icon-left w-full">
                            <i className="pi pi-link" />
                            <InputText
                                id="inspiration"
                                value={currentInstanceId ? itemsData[currentInstanceId]?.inspiration || '' : ''}
                                onChange={(e) => {
                                    if (currentInstanceId) {
                                        setItemsData(prev => ({
                                            ...prev,
                                            [currentInstanceId]: {
                                                ...prev[currentInstanceId],
                                                inspiration: e.target.value
                                            }
                                        }));
                                    }
                                }}
                                className="w-full"
                                placeholder="Add Inspiration"
                            />
                        </span>
                    </div>

                    <div className="flex flex-column gap-3 mb-4">
                        <div className="field">
                            <label htmlFor="deliveryDate">Delivery Date</label>
                            <Calendar
                                id="deliveryDate"
                                value={currentInstanceId ? itemsData[currentInstanceId]?.deliveryDate || null : null}
                                onChange={(e) => {
                                    if (currentInstanceId) {
                                        setItemsData(prev => ({
                                            ...prev,
                                            [currentInstanceId]: {
                                                ...prev[currentInstanceId],
                                                deliveryDate: e.value as Date
                                            }
                                        }));
                                    }
                                }}
                                dateFormat="dd/mm/yy"
                                className="w-full"
                                showIcon
                                showTime
                                hourFormat="12"
                                placeholder="Select Delivery Date"
                                timeOnly={false}
                                minDate={new Date()}
                            />
                        </div>

                         <div className="field">
                            <label htmlFor="trialDate">Trial Date</label>
                            <Calendar
                                id="trialDate"
                                value={currentInstanceId ? itemsData[currentInstanceId]?.trialDate || null : null}
                                onChange={(e) => {
                                    if (currentInstanceId) {
                                        setItemsData(prev => ({
                                            ...prev,
                                            [currentInstanceId]: {
                                                ...prev[currentInstanceId],
                                                trialDate: e.value as Date
                                            }
                                        }));
                                    }
                                }}
                                dateFormat="dd/mm/yy"
                                className="w-full"
                                showIcon
                                showTime
                                hourFormat="12"
                                placeholder="Select Trial Date"
                                timeOnly={false}
                                minDate={new Date()}
                            />
                        </div>
                    </div>

                    <div className="field mb-4">
                        <div className="flex align-items-center">
                            <Checkbox
                                inputId="priority"
                                checked={currentInstanceId ? itemsData[currentInstanceId]?.isPriority || false : false}
                                onChange={(e) => {
                                    if (currentInstanceId) {
                                        setItemsData(prev => ({
                                            ...prev,
                                            [currentInstanceId]: {
                                                ...prev[currentInstanceId],
                                                isPriority: e.checked ?? false
                                            }
                                        }));
                                    }
                                }}
                            />
                            <label htmlFor="priority" className="ml-2 mb-0">Prioritize Order</label>
                        </div>
                    </div>

                    <Divider />

                    <div className="flex flex-column gap-3">
                        <div className="field">
                            <label htmlFor="price">Stitching Price (₹)</label>
                            <InputNumber
                                id="price"
                                value={currentInstanceId ? itemsData[currentInstanceId]?.stitchingPrice || 0 : 0}
                                onValueChange={(e) => {
                                if (currentInstanceId) {
                                    setItemsData(prev => ({
                                    ...prev,
                                    [currentInstanceId]: {
                                        ...prev[currentInstanceId],
                                        stitchingPrice: e.value || 0
                                    }
                                    }));
                                }
                                }}
                                onFocus={(e) => {
                                if ((currentInstanceId ? itemsData[currentInstanceId]?.stitchingPrice || 0 : 0) === 0) {
                                    setTimeout(() => {
                                    e.target.select();
                                    }, 0);
                                }
                                }}
                                mode="currency"
                                currency="INR"
                                locale="en-IN"
                                className="w-full"
                                placeholder="Enter amount"
                                minFractionDigits={0}
                                maxFractionDigits={2}
                            />
                        </div>

                        <div className="field">
                            <Button
                                label="Add Additional Cost"
                                icon="pi pi-plus"
                                className="p-button-outlined w-8"
                                onClick={() => setShowAddCostDialog(true)}
                            />
                        </div>
                    </div>

                    <div className="surface-50 p-3 border-round mt-4">
                        <h5 className="mt-0 mb-3">Price Breakup</h5>
                        <Divider className="my-2" />
                        
                        {currentInstanceId && (
                            <>
                                <div className="flex justify-content-between align-items-center mb-3">
                                    <span className="text-600">Stitching Price</span>
                                    <span>
                                        ₹{(itemsData[currentInstanceId]?.stitchingPrice || 0).toFixed(2)}
                                    </span>
                                </div>

                                {itemsData[currentInstanceId]?.additionalCosts?.map((cost) => (
                                    <div key={cost.id} className="flex justify-content-between align-items-center">
                                        <div className="flex align-items-center gap-2">
                                            <span className="text-600">{cost.description}</span>
                                            <Button 
                                                icon="pi pi-trash" 
                                                className="p-button-rounded p-button-text p-button-danger p-button-sm" 
                                                onClick={() => {
                                                    setItemsData(prev => ({
                                                        ...prev,
                                                        [currentInstanceId]: {
                                                            ...prev[currentInstanceId],
                                                            additionalCosts: prev[currentInstanceId].additionalCosts.filter(c => c.id !== cost.id)
                                                        }
                                                    }));
                                                }}
                                            />
                                        </div>
                                        <span>₹{cost.amount.toFixed(2)}</span>
                                    </div>
                                ))}
                                
                                <Divider className="my-2" />
                                
                                <div className="flex justify-content-between align-items-center font-bold">
                                    <span className="text-600">Total:</span>
                                    <span>
                                        ₹{(garmentTotals[currentInstanceId] || 0).toFixed(2)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </Dialog>

            <Dialog 
                header={`${currentGarment?.name} Measurements`}
                visible={visible}
                onHide={() => setVisible(false)}
                maximized={isMaximized}
                onMaximize={(e) => setIsMaximized(e.maximized)}
                className={isMaximized ? 'maximized-dialog' : ''}
                blockScroll
                footer={measurementFooter}
            >
                <div className="p-fluid mt-4">
                    {isLoadingMeasurements ? (
                    <div className="flex justify-content-center p-5">
                        <i className="pi pi-spinner pi-spin"></i>
                    </div>
                    ) : (
                    measurementData
                        .sort((a, b) => a.seq - b.seq)
                        .map((master) => (
                        <div key={master.id} className="field mb-4">
                            <label htmlFor={master.measurement_name} className="block mb-2 font-medium">
                            {master.measurement_name} ({master.data_type})
                            </label>
                            {master.data_type === 'number' ? (
                            <InputNumber 
                                id={master.measurement_name}
                                value={currentMeasurements[master.measurement_name]?.val ? parseFloat(currentMeasurements[master.measurement_name].val!) : null}
                                onChange={(e) => handleMeasurementChange(
                                master.measurement_name,
                                e.value?.toString() || ''
                                )}
                                mode="decimal" 
                                min={0} 
                                className="w-full"
                            />
                            ) : (
                            <InputText
                                id={master.measurement_name}
                                value={currentMeasurements[master.measurement_name]?.val || ''}
                                onChange={(e) => handleMeasurementChange(
                                master.measurement_name,
                                e.target.value
                                )}
                                className="w-full"
                            />
                            )}
                        </div>
                        ))
                    )}
                </div>
            </Dialog>

            <Dialog 
                header="Stitch Options" 
                visible={showStitchOptionsDialog} 
                maximized={isMaximized}
                onMaximize={(e) => setIsMaximized(e.maximized)}
                footer={stitchFooter}
                onHide={() => setShowStitchOptionsDialog(false)}
                className={isMaximized ? 'maximized-dialog' : ''}
                blockScroll
            >
                <div className="p-fluid">
                    <div className="my-4">
                        <div className="surface-100 p-3 border-round mb-3">
                            <h5 className="m-0 font-medium">Top</h5>
                        </div>
                        
                        <div className="field mb-4">
                            <h5 className="m-0 mb-3">Collar</h5>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="collar1" 
                                        name="collar" 
                                        value="Mandarin" 
                                        onChange={(e) => setCollarOption(e.value)} 
                                        checked={collarOption === 'Mandarin'} 
                                    />
                                    <label htmlFor="collar1" className="ml-2">Mandarin</label>
                                </div>
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="collar2" 
                                        name="collar" 
                                        value="Stand" 
                                        onChange={(e) => setCollarOption(e.value)} 
                                        checked={collarOption === 'Stand'} 
                                    />
                                    <label htmlFor="collar2" className="ml-2">Stand</label>
                                </div>
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="collar3" 
                                        name="collar"
                                        value="Classic" 
                                        onChange={(e) => setCollarOption(e.value)} 
                                        checked={collarOption === 'Classic'} 
                                    />
                                    <label htmlFor="collar3" className="ml-2">Classic</label>
                                </div>
                            </div>
                        </div>

                        <Divider className="my-3" />

                        <div className="field mb-4">
                            <h5 className="m-0 mb-3">Pockets</h5>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="pocket1" 
                                        name="pocket" 
                                        value="Straight" 
                                        onChange={(e) => setPocketOption(e.value)} 
                                        checked={pocketOption === 'Straight'} 
                                    />
                                    <label htmlFor="pocket1" className="ml-2">Straight</label>
                                </div>
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="pocket2" 
                                        name="pocket" 
                                        value="Slant" 
                                        onChange={(e) => setPocketOption(e.value)} 
                                        checked={pocketOption === 'Slant'} 
                                    />
                                    <label htmlFor="pocket2" className="ml-2">Slant</label>
                                </div>
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="pocket3" 
                                        name="pocket" 
                                        value="Patch" 
                                        onChange={(e) => setPocketOption(e.value)} 
                                        checked={pocketOption === 'Patch'} 
                                    />
                                    <label htmlFor="pocket3" className="ml-2">Patch</label>
                                </div>
                            </div>
                        </div>

                        <Divider className="my-3" />

                        <div className="field mb-4">
                            <h5 className="m-0 mb-3">Pocket Square</h5>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="pocketSquare1" 
                                        name="pocketSquare" 
                                        value="Yes" 
                                        onChange={(e) => setPocketSquareOption(e.value)} 
                                        checked={pocketSquareOption === 'Yes'} 
                                    />
                                    <label htmlFor="pocketSquare1" className="ml-2">Yes</label>
                                </div>
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="pocketSquare2" 
                                        name="pocketSquare" 
                                        value="No" 
                                        onChange={(e) => setPocketSquareOption(e.value)} 
                                        checked={pocketSquareOption === 'No'} 
                                    />
                                    <label htmlFor="pocketSquare2" className="ml-2">No</label>
                                </div>
                            </div>
                        </div>

                        <Divider className="my-3" />

                        <div className="field mb-4">
                            <h5 className="m-0 mb-3">Cuffs</h5>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="cuffs1" 
                                        name="cuffs" 
                                        value="Yes" 
                                        onChange={(e) => setCuffsOption(e.value)} 
                                        checked={cuffsOption === 'Yes'} 
                                    />
                                    <label htmlFor="cuffs1" className="ml-2">Yes</label>
                                </div>
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="cuffs2" 
                                        name="cuffs" 
                                        value="No" 
                                        onChange={(e) => setCuffsOption(e.value)} 
                                        checked={cuffsOption === 'No'} 
                                    />
                                    <label htmlFor="cuffs2" className="ml-2">No</label>
                                </div>
                            </div>
                        </div>

                        <Divider className="my-3" />

                        <div className="field">
                            <h5 className="m-0 mb-3">Sleeves</h5>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="sleeve1" 
                                        name="sleeve" 
                                        value="Full" 
                                        onChange={(e) => setSleeveOption(e.value)} 
                                        checked={sleeveOption === 'Full'} 
                                    />
                                    <label htmlFor="sleeve1" className="ml-2">Full</label>
                                </div>
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="sleeve2" 
                                        name="sleeve" 
                                        value="Half" 
                                        onChange={(e) => setSleeveOption(e.value)} 
                                        checked={sleeveOption === 'Half'}
                                    />
                                    <label htmlFor="sleeve2" className="ml-2">Half</label>
                                </div>
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="sleeve3" 
                                        name="sleeve" 
                                        value="Three Quarter" 
                                        onChange={(e) => setSleeveOption(e.value)} 
                                        checked={sleeveOption === 'Three Quarter'} 
                                    />
                                    <label htmlFor="sleeve3" className="ml-2">Three Quarter</label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="surface-100 p-3 border-round mb-3">
                            <h5 className="m-0 font-medium">Bottom</h5>
                        </div>
                        
                        <div className="field mb-4">
                            <h5 className="m-0 mb-3">Pants/Pyjamas</h5>
                            <div className="flex flex-wrap gap-3">
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="bottom3" 
                                        name="bottom" 
                                        value="Straight" 
                                        onChange={(e) => setBottomOption(e.value)} 
                                        checked={bottomOption === 'Straight'} 
                                    />
                                    <label htmlFor="bottom3" className="ml-2">Straight</label>
                                </div>
                                <div className="flex align-items-center">
                                    <RadioButton 
                                        inputId="bottom4" 
                                        name="bottom" 
                                        value="Slant" 
                                        onChange={(e) => setBottomOption(e.value)} 
                                        checked={bottomOption === 'Slant'} 
                                    />
                                    <label htmlFor="bottom4" className="ml-2">Slant</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Dialog>

            <Dialog 
                visible={showImageSourceDialog} 
                onHide={() => setShowImageSourceDialog(false)}
                style={{ width: '95vw', maxWidth: '400px' }}
            >
                <div className="flex flex-column gap-3 p-3">
                <Button 
                    icon="pi pi-camera" 
                    label="Take Photo" 
                    className="p-button-outlined" 
                    onClick={() => currentInstanceId && handleImageSourceSelect('camera', currentInstanceId)}
                    disabled={!currentInstanceId}
                />
                <Button 
                    icon="pi pi-images" 
                    label="Choose from Gallery" 
                    className="p-button-outlined" 
                    onClick={() => currentInstanceId && handleImageSourceSelect('gallery', currentInstanceId)}
                    disabled={!currentInstanceId}
                />
                <Button 
                    icon="pi pi-folder-open" 
                    label="Choose Files" 
                    className="p-button-outlined" 
                    onClick={() => {
                    setShowImageSourceDialog(false);
                    imageUploadRef?.click();
                    }}
                />
                </div>
            </Dialog>

            <Dialog 
                header="Add Additional Cost" 
                visible={showAddCostDialog} 
                onHide={() => {
                    setShowAddCostDialog(false);
                    setNewCostDescription('');
                    setNewCostAmount(null);
                }}
                style={{ width: '95vw', maxWidth: '400px' }}
                footer={
                    <div>
                        <Button 
                            label="Cancel" 
                            icon="pi pi-times" 
                            onClick={() => {
                                setShowAddCostDialog(false);
                                setNewCostDescription('');
                                setNewCostAmount(null);
                            }} 
                            className="p-button-text" 
                        />
                        <Button 
                            label="Add" 
                            icon="pi pi-check" 
                            onClick={() => {
                                if (newCostDescription && newCostAmount && currentInstanceId) {
                                    setItemsData(prev => {
                                        const currentItem = prev[currentInstanceId] || {
                                            type: 'stitching',
                                            specialInstructions: '',
                                            deliveryDate: null,
                                            trialDate: null,
                                            isPriority: false,
                                            quantity: 1,
                                            stitchingPrice: 0,
                                            inspiration: '',
                                            uploadedImages: [],
                                            additionalCosts: []
                                        };

                                        return {
                                            ...prev,
                                            [currentInstanceId]: {
                                                ...currentItem,
                                                additionalCosts: [
                                                    ...(currentItem.additionalCosts || []),
                                                    {
                                                        id: Date.now().toString(),
                                                        description: newCostDescription,
                                                        amount: newCostAmount
                                                    }
                                                ]
                                            }
                                        };
                                    });
                                    setShowAddCostDialog(false);
                                    setNewCostDescription('');
                                    setNewCostAmount(null);
                                }
                            }} 
                            autoFocus 
                        />
                    </div>
                }
            >
                <div className="p-fluid">
                    <div className="field my-4">
                        <label htmlFor="costDescription">Title</label>
                        <InputText 
                            id="costDescription" 
                            value={newCostDescription} 
                            onChange={(e) => setNewCostDescription(e.target.value)} 
                            className="w-full" 
                            placeholder="e.g., Embroidery, Special Fabric, etc." 
                        />
                    </div>
                    <div className="field">
                        <label htmlFor="costAmount">Amount (₹)</label>
                        <InputNumber 
                            id="costAmount" 
                            value={newCostAmount} 
                            onValueChange={(e) => setNewCostAmount(e.value ?? null)} 
                            mode="currency" 
                            currency="INR" 
                            locale="en-IN" 
                            className="w-full"
                        />
                    </div>
                </div>
            </Dialog>

            <div className="fixed bottom-0 left-0 right-0 bg-white shadow-2 border-top-1 surface-border mb-5">
                <div className="flex justify-content-between align-items-center p-3 surface-100">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold">
                        ₹{Object.values(garmentTotals)
                            .reduce((sum, current) => sum + (Number(current) || 0), 0)
                            .toFixed(2)}
                    </span>
                </div>
                <div className="p-3 mb-5">
                    <Button 
                        label={isConfirmingOrder ? '' : "Confirm Order"}
                        icon={isConfirmingOrder ? "pi pi-spinner pi-spin" : ""}
                        onClick={handleConfirmOrder}
                        className="w-full"
                        disabled={!selectedCustomer || selectedGarments.length === 0 || isConfirmingOrder}
                    />
                </div>
            </div>

            <Dialog
                visible={activeIndex !== null}
                style={{ width: '95vw', maxWidth: '800px' }}
                onHide={() => setActiveIndex(null)}
                modal
            >
                <Galleria
                    value={currentInstanceId ? itemsData[currentInstanceId]?.uploadedImages || [] : []}
                    activeIndex={activeIndex ?? 0}
                    onItemChange={(e) => setActiveIndex(e.index)}
                    showThumbnails={false}
                    showIndicators
                    item={itemTemplate}
                    thumbnail={thumbnailTemplate}
                    circular
                    autoPlay={false}
                />
            </Dialog>
        </div>
    );
};

export default CreateOrder;