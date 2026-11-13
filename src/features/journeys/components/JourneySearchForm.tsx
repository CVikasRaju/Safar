import { useId, useState } from "react";
import { Search } from "lucide-react";
import type { JourneySearchRequest } from "../../../domain/types/journey";
import { isValidHhmm, isValidIsoDate } from "../../../domain/calculations/time";
import { useSafarState } from "../../../state/SafarStateContext";
import { Button, Field, Select, TextInput } from "../../../components/ui";

export interface JourneySearchFormProps {
  initial: JourneySearchRequest;
  onSubmit: (request: JourneySearchRequest) => void;
  submitLabel?: string;
  compact?: boolean;
}

export function JourneySearchForm({
  initial,
  onSubmit,
  submitLabel = "Find journeys",
  compact = false,
}: JourneySearchFormProps) {
  const { state } = useSafarState();
  const idPrefix = useId();
  const [originVillageId, setOriginVillageId] = useState(initial.originVillageId);
  const [destinationId, setDestinationId] = useState(initial.destinationId);
  const [travelDate, setTravelDate] = useState(initial.travelDate);
  const [requiredArrivalTime, setRequiredArrivalTime] = useState(initial.requiredArrivalTime);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!state.villages.some((village) => village.id === originVillageId)) {
      nextErrors.origin = "Select your starting village.";
    }
    if (!state.destinations.some((destination) => destination.id === destinationId)) {
      nextErrors.destination = "Select where you are travelling to.";
    }
    if (!isValidIsoDate(travelDate)) {
      nextErrors.travelDate = "Choose a valid travel date.";
    }
    if (!isValidHhmm(requiredArrivalTime)) {
      nextErrors.requiredArrivalTime = "Enter the time you must arrive by, e.g. 09:00.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      originVillageId,
      destinationId,
      travelDate,
      requiredArrivalTime,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
        <Field label="Origin village" htmlFor={`${idPrefix}-origin`} error={errors.origin} required>
          <Select
            id={`${idPrefix}-origin`}
            value={originVillageId}
            onChange={(event) => setOriginVillageId(event.target.value)}
            aria-invalid={errors.origin ? "true" : undefined}
          >
            {state.villages.map((village) => (
              <option key={village.id} value={village.id}>
                {village.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Destination"
          htmlFor={`${idPrefix}-destination`}
          error={errors.destination}
          required
        >
          <Select
            id={`${idPrefix}-destination`}
            value={destinationId}
            onChange={(event) => setDestinationId(event.target.value)}
            aria-invalid={errors.destination ? "true" : undefined}
          >
            {state.destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Travel date" htmlFor={`${idPrefix}-date`} error={errors.travelDate} required>
          <TextInput
            id={`${idPrefix}-date`}
            type="date"
            value={travelDate}
            onChange={(event) => setTravelDate(event.target.value)}
            aria-invalid={errors.travelDate ? "true" : undefined}
          />
        </Field>

        <Field
          label="Arrive by"
          htmlFor={`${idPrefix}-arrival`}
          hint="Required arrival time at your destination."
          error={errors.requiredArrivalTime}
          required
        >
          <TextInput
            id={`${idPrefix}-arrival`}
            type="time"
            value={requiredArrivalTime}
            onChange={(event) => setRequiredArrivalTime(event.target.value)}
            aria-invalid={errors.requiredArrivalTime ? "true" : undefined}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary">
          <Search size={14} /> {submitLabel}
        </Button>
        <p className="text-[11px] text-muted">
          Demo timetable · at most one bus change · walking values are approximate.
        </p>
      </div>
    </form>
  );
}
