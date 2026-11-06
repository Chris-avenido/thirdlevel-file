import { forwardRef, useId } from 'react';

// The one shared text-like field: label floats on the border, inline error underneath.
// `as` is 'input' (default), 'select' or 'textarea'. All other props go to the control.
const FloatingLabelInput = forwardRef(function FloatingLabelInput(
    { as: Control = 'input', label, error, required, requiredMark, icon, id, className = '', inputClassName = '', children, ...rest },
    ref,
) {
    const autoId = useId();
    const fieldId = id || (rest.name ? `field-${rest.name}` : autoId);
    const errorId = `${fieldId}-error`;
    const isTextarea = Control === 'textarea';
    const showMark = required || requiredMark;

    const base = 'peer block w-full rounded-md border bg-card text-[15px] text-heading outline-none transition-colors duration-150 '
        + 'placeholder:text-secondary disabled:cursor-not-allowed disabled:bg-brand-50 disabled:text-secondary '
        + (isTextarea ? 'min-h-[88px] px-3 py-2.5 ' : 'h-11 px-3 md:h-10 ')
        + (icon ? 'pl-10 ' : '')
        + (error
            ? 'border-danger-700 focus:ring-2 focus:ring-danger-700/20'
            : 'border-secondary focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20');

    return (
        <div className={`relative ${className}`}>
            <Control
                ref={ref}
                id={fieldId}
                required={required}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                className={`${base} ${inputClassName}`}
                {...rest}
            >
                {children}
            </Control>
            {icon ? (
                <span className="pointer-events-none absolute left-3 top-[22px] -translate-y-1/2 text-secondary md:top-5">{icon}</span>
            ) : null}
            {label ? (
                <label
                    htmlFor={fieldId}
                    className={`pointer-events-none absolute -top-2 left-2.5 bg-card px-1 text-[13px] font-semibold leading-4 ${error ? 'text-danger-700' : 'text-secondary peer-focus:text-brand-700'}`}
                >
                    {label}
                    {showMark ? <span className="ml-0.5 text-danger-700" aria-hidden="true">*</span> : null}
                </label>
            ) : null}
            {error ? (
                <p id={errorId} className="mt-1 text-[13px] font-medium text-danger-700">{error}</p>
            ) : null}
        </div>
    );
});

export default FloatingLabelInput;
