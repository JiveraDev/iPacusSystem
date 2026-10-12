import { useEffect, useId, useMemo, useState } from 'react';
import { Input } from '../../ui/input';
import { PET_SPECIES_OPTIONS, petBreedOptions } from '../../lib/petCatalog';
import { fetchPetCatalog } from '../../services/petCatalogService';

function uniqueOptions(values) {
    const options = new Map();

    values.forEach((value) => {
        const label = String(value || '').trim();
        const key = label.toLocaleLowerCase();
        if (label && !options.has(key)) options.set(key, label);
    });

    return Array.from(options.values()).sort((left, right) => left.localeCompare(right));
}

function remoteBreedOptions(catalog, species) {
    const normalizedSpecies = String(species || '').trim().toLocaleLowerCase();
    const matchedSpecies = Object.keys(catalog?.breedsBySpecies || {})
        .find(option => option.toLocaleLowerCase() === normalizedSpecies);

    return matchedSpecies ? catalog.breedsBySpecies[matchedSpecies] : [];
}

function useRegisteredPetCatalog() {
    const [catalog, setCatalog] = useState(null);

    useEffect(() => {
        let isActive = true;

        fetchPetCatalog()
            .then((result) => {
                if (isActive) setCatalog(result);
            })
            .catch(() => {
                // The bundled catalog remains available when the API is offline.
            });

        return () => {
            isActive = false;
        };
    }, []);

    return catalog;
}

function PetCatalogAutocomplete({ options, restriction, ...inputProps }) {
    const generatedId = useId().replace(/:/g, '');
    const listId = `${inputProps.id || 'pet-catalog'}-${generatedId}-options`;

    return (
        <>
            <Input
                {...inputProps}
                type="text"
                list={listId}
                restriction={restriction}
                autoComplete="off"
                aria-autocomplete="list"
            />
            <datalist id={listId}>
                {options.map(option => <option key={option} value={option} />)}
            </datalist>
        </>
    );
}

export function PetSpeciesAutocomplete(props) {
    const catalog = useRegisteredPetCatalog();
    const options = useMemo(
        () => uniqueOptions([...PET_SPECIES_OPTIONS, ...(catalog?.species || [])]),
        [catalog]
    );

    return (
        <PetCatalogAutocomplete
            {...props}
            options={options}
            restriction="pet-species"
        />
    );
}

export function PetBreedAutocomplete({ species, ...props }) {
    const catalog = useRegisteredPetCatalog();
    const options = useMemo(
        () => uniqueOptions([...petBreedOptions(species), ...remoteBreedOptions(catalog, species)]),
        [catalog, species]
    );

    return (
        <PetCatalogAutocomplete
            {...props}
            options={options}
            restriction="pet-breed"
        />
    );
}
