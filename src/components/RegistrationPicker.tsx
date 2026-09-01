import type { Registration } from "../domain/models";

export default function RegistrationPicker(props: {
  registrations: Registration[];
  value: string;
  onChange: (registrationId: string) => void;
}) {
  return (

    <label className="form-control">
      <div className="label">
        <span className="label-text">Registration</span>
      </div>

      <select
        className="select select-bordered w-full"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        >
        {props.registrations.map((r) => (
        <option key={r.id} value={r.id}>
          {r.tailNumber}
        </option>
          ))}
        </select>
    </label>


  );
}

