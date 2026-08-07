import { Autocomplete, TextField } from '@mui/material';

/**
 * Drop-in replacement for the <FormControl><InputLabel/><Select> trio used for
 * data-driven pickers (exams, levels, classes, students, organizations, plans).
 *
 * Those lists grow to hundreds of entries, where a plain Select means scrolling
 * blind — this renders MUI's Autocomplete so the list can be narrowed by typing.
 *
 * The Select-style contract is kept deliberately: `value` is the raw option
 * value and `onChange` receives that value directly rather than an event, so
 * call sites keep their existing handlers.
 */
const SearchableSelect = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Type to search...',
  size = 'small',
  fullWidth = true,
  disabled = false,
  clearable = true,
  emptyValue = '',
  noOptionsText = 'No matches found',
  loading = false,
  multiple = false,
  sx,
  textFieldProps = {},
  ...rest
}) => {
  // `multiple` keeps the array-of-values contract a multi Select already has.
  const selected = multiple
    ? options.filter(option => (value || []).includes(option.value))
    : options.find(option => option.value === value) ?? null;

  return (
    <Autocomplete
      multiple={multiple}
      options={options}
      value={selected}
      onChange={(_event, option) => onChange(
        multiple
          ? (option || []).map(o => o.value)
          : (option ? option.value : emptyValue)
      )}
      getOptionLabel={(option) => option?.label ?? ''}
      isOptionEqualToValue={(option, selectedOption) => option.value === selectedOption.value}
      getOptionDisabled={(option) => !!option.disabled}
      disabled={disabled}
      loading={loading}
      fullWidth={fullWidth}
      size={size}
      disableClearable={!clearable}
      noOptionsText={noOptionsText}
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          {...textFieldProps}
        />
      )}
      {...rest}
    />
  );
};

export default SearchableSelect;
