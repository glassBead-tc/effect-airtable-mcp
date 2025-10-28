# Airtable MCP Server - API Update Specification

## Executive Summary

This specification outlines the required updates to bring the Airtable MCP Server codebase up to date with the current Airtable Web API (as of 2025). The current implementation supports only 10 field types, while Airtable now provides 33+ field types with enhanced capabilities.

**Research Sources:**
- Airtable Web API Documentation (https://airtable.com/developers/web/api/)
- Airtable Scripting API Cell Values (https://airtable.com/developers/scripting/api/cell_values)
- Airtable Support Documentation (https://support.airtable.com/docs/)
- Community forums and third-party documentation

---

## 1. Current State Analysis

### Supported Field Types (Current - 10 types)
```typescript
type FieldType =
  | "singleLineText"
  | "multilineText"
  | "number"
  | "singleSelect"
  | "multiSelect"
  | "date"
  | "checkbox"
  | "email"
  | "phoneNumber"
  | "currency";
```

### Current Limitations
- **Missing 23+ field types** including attachments, URLs, rich text, linked records, formulas, rollups, buttons, barcodes, ratings, etc.
- **Limited query parameters** - No support for sorting, pagination offsets, cell formatting options
- **No attachment handling** - Cannot upload/download files
- **No computed field support** - Formula, lookup, rollup, count fields not typed
- **No collaborator fields** - createdBy, lastModifiedBy not supported
- **Missing special field types** - Button, barcode, rating, duration, autonumber
- **No batch operations optimization** - Could support typecast parameter for flexible updates

---

## 2. Complete Field Type Catalog

Based on Airtable's current API documentation, here are all 33+ supported field types:

### Text Fields
1. **singleLineText** ✅ (Already supported)
   - Cell: `string`
   - Options: n/a

2. **multilineText** ✅ (Already supported)
   - Cell: `string` (supports mention tokens like `@Alex`)
   - Options: n/a

3. **richText** ❌ (NEW - NEEDS SUPPORT)
   - Cell: `string` (markdown or HTML formatted text)
   - Options: n/a

### Communication Fields
4. **email** ✅ (Already supported)
   - Cell: `string`
   - Options: n/a

5. **url** ❌ (NEW - NEEDS SUPPORT)
   - Cell: `string` (valid URL)
   - Options: n/a

6. **phoneNumber** ✅ (Already supported)
   - Cell: `string`
   - Options: n/a

### Number Fields
7. **number** ✅ (Already supported)
   - Cell: `number`
   - Options: `{ precision: number }` (0-8)

8. **currency** ✅ (Already supported)
   - Cell: `number`
   - Options: `{ precision: number, symbol: string }` (precision 0-7)

9. **percent** ❌ (NEW - NEEDS SUPPORT)
   - Cell: `number` (0 = 0%, 0.5 = 50%, 1 = 100%)
   - Options: `{ precision: number }` (0-8)

10. **duration** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `number` (duration in seconds)
    - Options: `{ durationFormat: string }` (e.g., "h:mm", "h:mm:ss")

11. **rating** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `number` (1-10)
    - Options: `{ max: number, icon: string, color: string }`

12. **autonumber** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `number` (read-only, auto-generated)
    - Options: n/a

### Selection Fields
13. **singleSelect** ✅ (Already supported - but needs update)
    - Cell read: `{ id: string, name: string, color?: string }`
    - Cell write: `{ id: string } | { name: string }`
    - Options: `{ choices: Array<{ id?: string, name: string, color?: string }> }`

14. **multipleSelects** ✅ (Already supported as "multiSelect" - needs update)
    - Cell read: `Array<{ id: string, name: string, color?: string }>`
    - Cell write: `Array<{ id: string } | { name: string }>`
    - Options: `{ choices: Array<{ id?: string, name: string, color?: string }> }`

### Boolean Fields
15. **checkbox** ✅ (Already supported)
    - Cell: `boolean`
    - Options: `{ icon: string, color: string }`

### Date/Time Fields
16. **date** ✅ (Already supported - but needs enhancement)
    - Cell: `string` (ISO 8601 format)
    - Options: `{ dateFormat: { name: string, format?: string } }`

17. **dateTime** ❌ (NEW - NEEDS SUPPORT - separate from "date")
    - Cell: `string` (ISO 8601 format with time)
    - Options: `{ dateFormat: { name: string }, timeFormat: { name: string }, timeZone: string }`

18. **createdTime** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `string` (ISO 8601 format, read-only)
    - Options: `{ result: { type: string, options: {...} } }`

19. **lastModifiedTime** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `string` (ISO 8601 format, read-only)
    - Options: `{ isValid: boolean, referencedFieldIds?: string[], result: {...} }`

### Collaborator Fields
20. **createdBy** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `{ id: string, email: string, name?: string }`
    - Options: n/a

21. **lastModifiedBy** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `{ id: string, email: string, name?: string }`
    - Options: `{ isValid: boolean, referencedFieldIds?: string[] }`

### Relational Fields
22. **multipleRecordLinks** ❌ (NEW - NEEDS SUPPORT)
    - Cell read: `Array<{ id: string, name?: string }>`
    - Cell write: `Array<{ id: string }>`
    - Options: `{ linkedTableId: string, prefersSingleRecordLink?: boolean, inverseLinkFieldId?: string }`

23. **multipleLookupValues** ❌ (NEW - NEEDS SUPPORT)
    - Cell: varies (array of values from linked records)
    - Options: `{ isValid: boolean, recordLinkFieldId: string, fieldIdInLinkedTable: string, result?: {...} }`

24. **rollup** ❌ (NEW - NEEDS SUPPORT)
    - Cell: varies (computed from linked records)
    - Options: `{ isValid: boolean, recordLinkFieldId: string, fieldIdInLinkedTable: string, referencedFieldIds?: string[], result?: {...} }`

25. **count** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `number` (count of linked records)
    - Options: `{ isValid: boolean, recordLinkFieldId: string }`

### Computed Fields
26. **formula** ❌ (NEW - NEEDS SUPPORT)
    - Cell: varies (computed value, read-only)
    - Options: `{ isValid: boolean, formula: string, referencedFieldIds?: string[], result?: {...} }`

### Attachment & Media
27. **multipleAttachments** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `Array<{ id: string, url: string, filename: string, size: number, type: string, thumbnails?: {...} }>`
    - Options: `{ isReversed: boolean }`

### Interactive Fields
28. **button** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `{ label: string, url?: string }`
    - Options: `{ label: string, url?: string }`

29. **barcode** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `{ text: string, type?: string }`
    - Options: n/a

### Special Fields
30. **externalSyncSource** ❌ (NEW - NEEDS SUPPORT)
    - Cell: varies (synced from external source)
    - Options: varies

31. **multipleCollaborators** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `Array<{ id: string, email: string, name?: string }>`
    - Options: n/a

32. **singleCollaborator** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `{ id: string, email: string, name?: string }`
    - Options: n/a

33. **aiText** ❌ (NEW - NEEDS SUPPORT)
    - Cell: `string` (AI-generated text)
    - Options: `{ prompt: string, referencedFieldIds?: string[] }`

---

## 3. API Endpoint Enhancements

### Current Endpoints (Supported)
- `GET /meta/bases` - List bases ✅
- `GET /meta/bases/{baseId}/tables` - List tables ✅
- `POST /meta/bases/{baseId}/tables` - Create table ✅
- `PATCH /meta/bases/{baseId}/tables/{tableId}` - Update table ✅
- `POST /meta/bases/{baseId}/tables/{tableId}/fields` - Create field ✅
- `PATCH /meta/bases/{baseId}/tables/{tableId}/fields/{fieldId}` - Update field ✅
- `GET /{baseId}/{tableIdOrName}` - List records ✅
- `POST /{baseId}/{tableIdOrName}` - Create record ✅
- `PATCH /{baseId}/{tableIdOrName}/{recordId}` - Update record ✅
- `DELETE /{baseId}/{tableIdOrName}/{recordId}` - Delete record ✅

### Missing Endpoints (Need Implementation)
- `PATCH /{baseId}/{tableIdOrName}` - Batch update/create records ❌
- `DELETE /{baseId}/{tableIdOrName}` - Batch delete records ❌
- `GET /meta/bases/{baseId}/tables/{tableId}/fields/{fieldId}` - Get single field ❌
- `DELETE /meta/bases/{baseId}/tables/{tableId}/fields/{fieldId}` - Delete field ❌
- `DELETE /meta/bases/{baseId}/tables/{tableId}` - Delete table ❌

### Enhanced Query Parameters

#### List Records Parameters (Need Support)
```typescript
interface ListRecordsParams {
  // Existing
  maxRecords?: number; // ✅ Supported
  
  // Missing (Add Support)
  pageSize?: number; // Number of records per page (default: 100, max: 100)
  offset?: string; // Pagination offset token
  view?: string; // View ID or name
  sort?: Array<{ field: string; direction: "asc" | "desc" }>; // Sort order
  filterByFormula?: string; // ✅ Partially supported in search_records
  fields?: string[]; // Specific fields to return
  cellFormat?: "json" | "string"; // Cell format (default: json)
  timeZone?: string; // Timezone for date fields
  userLocale?: string; // User locale for formatting
  returnFieldsByFieldId?: boolean; // Return fields by ID instead of name
}
```

#### Create/Update Records Parameters (Need Support)
```typescript
interface RecordMutationParams {
  // Missing (Add Support)
  typecast?: boolean; // Auto-convert field values to match field type
  returnFieldsByFieldId?: boolean; // Return fields by ID instead of name
}
```

---

## 4. Updated Type Definitions

### Proposed `types.ts` Structure

```typescript
// Extended Field Types
export type FieldType =
  // Text
  | "singleLineText"
  | "multilineText"
  | "richText"
  
  // Communication
  | "email"
  | "url"
  | "phoneNumber"
  
  // Number
  | "number"
  | "currency"
  | "percent"
  | "duration"
  | "rating"
  | "autonumber"
  
  // Selection
  | "singleSelect"
  | "multipleSelects"
  
  // Boolean
  | "checkbox"
  
  // Date/Time
  | "date"
  | "dateTime"
  | "createdTime"
  | "lastModifiedTime"
  
  // Collaborator
  | "createdBy"
  | "lastModifiedBy"
  | "singleCollaborator"
  | "multipleCollaborators"
  
  // Relational
  | "multipleRecordLinks"
  | "multipleLookupValues"
  | "rollup"
  | "count"
  
  // Computed
  | "formula"
  
  // Attachment
  | "multipleAttachments"
  
  // Interactive
  | "button"
  | "barcode"
  
  // Special
  | "externalSyncSource"
  | "aiText";

// Collaborator value type
export interface Collaborator {
  id: string;
  email: string;
  name?: string;
}

// Attachment value type
export interface Attachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  thumbnails?: {
    small?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
    full?: { url: string; width: number; height: number };
  };
}

// Record link value type
export interface RecordLink {
  id: string;
  name?: string;
}

// Select choice value type (enhanced)
export interface SelectChoice {
  id: string;
  name: string;
  color?: string;
}

// Button value type
export interface ButtonValue {
  label: string;
  url?: string;
}

// Barcode value type
export interface BarcodeValue {
  text: string;
  type?: string;
}

// Extended Field Values
export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | Collaborator
  | Collaborator[]
  | Attachment[]
  | RecordLink[]
  | SelectChoice
  | SelectChoice[]
  | ButtonValue
  | BarcodeValue
  | null
  | undefined;

// Field Options Types (Enhanced)

export interface PercentFieldOptions {
  precision: number; // 0-8
}

export interface DurationFieldOptions {
  durationFormat: string; // "h:mm", "h:mm:ss", etc.
}

export interface RatingFieldOptions {
  max: number; // 1-10
  icon: string;
  color: string;
}

export interface DateTimeFieldOptions {
  dateFormat: { name: string; format?: string };
  timeFormat?: { name: string };
  timeZone?: string;
}

export interface CheckboxFieldOptions {
  icon: string;
  color: string;
}

export interface MultipleRecordLinksOptions {
  linkedTableId: string;
  prefersSingleRecordLink?: boolean;
  inverseLinkFieldId?: string;
}

export interface LookupFieldOptions {
  isValid: boolean;
  recordLinkFieldId: string;
  fieldIdInLinkedTable: string;
  result?: FieldOptions;
}

export interface RollupFieldOptions {
  isValid: boolean;
  recordLinkFieldId: string;
  fieldIdInLinkedTable: string;
  referencedFieldIds?: string[];
  result?: FieldOptions;
}

export interface CountFieldOptions {
  isValid: boolean;
  recordLinkFieldId: string;
}

export interface FormulaFieldOptions {
  isValid: boolean;
  formula: string;
  referencedFieldIds?: string[];
  result?: FieldOptions;
}

export interface LastModifiedTimeOptions {
  isValid: boolean;
  referencedFieldIds?: string[];
  result?: FieldOptions;
}

export interface LastModifiedByOptions {
  isValid: boolean;
  referencedFieldIds?: string[];
}

export interface AttachmentFieldOptions {
  isReversed: boolean;
}

export interface ButtonFieldOptions {
  label: string;
  url?: string;
}

export interface AITextFieldOptions {
  prompt: string;
  referencedFieldIds?: string[];
}

// Union type for all field options
export type FieldOptions =
  | NumberFieldOptions
  | DateFieldOptions
  | DateTimeFieldOptions
  | CurrencyFieldOptions
  | SelectFieldOptions
  | PercentFieldOptions
  | DurationFieldOptions
  | RatingFieldOptions
  | CheckboxFieldOptions
  | MultipleRecordLinksOptions
  | LookupFieldOptions
  | RollupFieldOptions
  | CountFieldOptions
  | FormulaFieldOptions
  | LastModifiedTimeOptions
  | LastModifiedByOptions
  | AttachmentFieldOptions
  | ButtonFieldOptions
  | AITextFieldOptions;
```

---

## 5. Implementation Recommendations

### Phase 1: Critical Field Types (High Priority)
Add support for commonly used field types that are currently missing:

1. **url** - Simple string field, no options needed
2. **richText** - String field with formatting
3. **percent** - Similar to number field
4. **rating** - Number field with visual options
5. **multipleRecordLinks** - Essential for relational data
6. **multipleAttachments** - File handling capability
7. **createdTime** / **lastModifiedTime** - Audit fields
8. **createdBy** / **lastModifiedBy** - User tracking
9. **button** - Interactive elements
10. **barcode** - Mobile scanning support

### Phase 2: Computed Fields (Medium Priority)
Add read-only computed field support:

1. **formula** - Computed values
2. **rollup** - Aggregations from linked records
3. **multipleLookupValues** - Values from linked records
4. **count** - Count of linked records
5. **autonumber** - Auto-incrementing IDs

### Phase 3: Advanced Features (Lower Priority)
1. **aiText** - AI-generated content
2. **externalSyncSource** - External integrations
3. **dateTime** - Full date-time support (enhanced from date)
4. **duration** - Time duration tracking
5. **singleCollaborator** / **multipleCollaborators** - Team collaboration

### Phase 4: API Enhancements
1. Add pagination support (offset parameter)
2. Add sorting support (sort parameter)
3. Add field filtering (fields parameter)
4. Add batch operations (PATCH for multiple records)
5. Add typecast parameter for flexible type conversion
6. Add view parameter for filtered record lists
7. Implement batch delete operation

### Phase 5: Query Builder Enhancement
Enhance the `search_records` tool to support:
- Complex filterByFormula expressions
- Multiple sort criteria
- Field selection
- Cell format options

---

## 6. Code Structure Changes

### Updated `fieldRequiresOptions()` Function
```typescript
export const fieldRequiresOptions = (type: FieldType): boolean => {
  switch (type) {
    // Existing
    case "number":
    case "singleSelect":
    case "multipleSelects":
    case "date":
    case "currency":
    
    // New additions
    case "percent":
    case "duration":
    case "rating":
    case "dateTime":
    case "checkbox":
    case "multipleRecordLinks":
    case "multipleLookupValues":
    case "rollup":
    case "count":
    case "formula":
    case "lastModifiedTime":
    case "lastModifiedBy":
    case "multipleAttachments":
    case "button":
    case "aiText":
      return true;
      
    // Read-only computed fields (options not settable)
    case "createdTime":
    case "createdBy":
    case "autonumber":
    case "externalSyncSource":
      return false;
      
    // Simple fields
    case "singleLineText":
    case "multilineText":
    case "richText":
    case "email":
    case "url":
    case "phoneNumber":
    case "barcode":
    case "singleCollaborator":
    case "multipleCollaborators":
      return false;
      
    default:
      return false;
  }
};
```

### Updated `getDefaultOptions()` Function
```typescript
export const getDefaultOptions = (type: FieldType): FieldOptions | undefined => {
  switch (type) {
    // Existing
    case "number":
      return { precision: 0 };
    case "date":
      return { dateFormat: { name: "local" } };
    case "currency":
      return { precision: 2, symbol: "$" };
    case "singleSelect":
    case "multipleSelects":
      return { choices: [] };
      
    // New additions
    case "percent":
      return { precision: 0 };
    case "duration":
      return { durationFormat: "h:mm" };
    case "rating":
      return { max: 5, icon: "star", color: "yellowBright" };
    case "dateTime":
      return {
        dateFormat: { name: "local" },
        timeFormat: { name: "12hour" },
        timeZone: "UTC"
      };
    case "checkbox":
      return { icon: "check", color: "greenBright" };
    case "multipleAttachments":
      return { isReversed: false };
    case "button":
      return { label: "Click me", url: "" };
      
    // Fields with required complex options (should error if not provided)
    case "multipleRecordLinks":
    case "multipleLookupValues":
    case "rollup":
    case "count":
    case "formula":
    case "aiText":
      return undefined; // Require explicit options
      
    default:
      return undefined;
  }
};
```

---

## 7. Testing Strategy

### Unit Tests Required
1. Test all 33+ field types with `validateField()`
2. Test `fieldRequiresOptions()` for each type
3. Test `getDefaultOptions()` for each type
4. Test field creation with various option combinations
5. Test field updates with partial options
6. Test error handling for invalid field types/options

### Integration Tests Required
1. Create table with each field type
2. Create records with each field type
3. Update records with each field type
4. Query records with filtering/sorting
5. Test pagination with large record sets
6. Test batch operations
7. Test attachment upload/download (Phase 1)

---

## 8. Breaking Changes & Migration

### Potential Breaking Changes
1. **`multiSelect` → `multipleSelects`** - Rename for API consistency
2. **`date` field** - May need to differentiate from `dateTime`
3. **Select field cell format** - Now returns objects with `{id, name, color}` instead of just strings

### Migration Path
1. Add new field types alongside existing ones
2. Maintain backwards compatibility for old field type names
3. Add deprecation warnings for renamed types
4. Update documentation with migration examples
5. Provide utility functions for converting old → new format

---

## 9. Documentation Updates Required

1. Update README with complete field type list
2. Add field type reference guide
3. Add examples for each field type
4. Document query parameter options
5. Add API endpoint reference
6. Update WARP.md with new capabilities
7. Add troubleshooting guide for complex field types

---

## 10. Priority Implementation Order

### Immediate (Sprint 1)
1. Add missing simple field types (url, richText, percent)
2. Add audit fields (createdTime, lastModifiedTime, createdBy, lastModifiedBy)
3. Update select field handling to support full object format
4. Add attachment field type
5. Update type definitions

### Short-term (Sprint 2-3)
1. Add relational fields (multipleRecordLinks)
2. Add computed fields (formula, rollup, lookup, count)
3. Add interactive fields (button, barcode, rating)
4. Enhance query parameters (pagination, sorting)
5. Add batch operations

### Medium-term (Sprint 4-6)
1. Add collaborator fields
2. Add AI text field
3. Add duration field
4. Optimize performance for large datasets
5. Add comprehensive error handling

---

## 11. Performance Considerations

1. **Lazy Loading** - Don't fetch field options unless needed
2. **Caching** - Cache field schemas to reduce API calls
3. **Batch Operations** - Use batch endpoints for multiple records
4. **Pagination** - Implement cursor-based pagination for large tables
5. **Rate Limiting** - Current retry logic is good, but add exponential backoff tuning

---

## 12. Security Considerations

1. **API Key Rotation** - Support Personal Access Tokens (newer auth method)
2. **Field Permissions** - Some fields may be read-only based on permissions
3. **Attachment Security** - Validate file types and sizes for attachments
4. **Formula Injection** - Sanitize formula inputs to prevent injection
5. **Collaborator Privacy** - Handle PII in collaborator fields appropriately

---

## 13. Estimated Effort

### Development Time Estimates
- **Phase 1 (Critical)**: 2-3 weeks
- **Phase 2 (Computed)**: 1-2 weeks
- **Phase 3 (Advanced)**: 2-3 weeks
- **Phase 4 (API Enhancements)**: 2 weeks
- **Phase 5 (Query Builder)**: 1 week

**Total**: ~8-11 weeks for complete implementation

### Testing Time Estimates
- **Unit Tests**: 1 week
- **Integration Tests**: 1-2 weeks
- **Documentation**: 1 week

**Total Project**: ~10-14 weeks

---

## 14. Success Metrics

1. **Coverage**: Support for all 33+ Airtable field types
2. **Compatibility**: 100% backwards compatibility with existing integrations
3. **Performance**: <500ms average response time for typical operations
4. **Reliability**: <0.1% error rate on API calls
5. **Documentation**: Complete examples for every field type
6. **Testing**: >90% code coverage

---

## 15. References & Resources

### Official Documentation
- [Airtable Web API](https://airtable.com/developers/web/api/)
- [Airtable Scripting API - Cell Values](https://airtable.com/developers/scripting/api/cell_values)
- [Supported Field Types Overview](https://support.airtable.com/docs/supported-field-types-in-airtable-overview)
- [Airtable Metadata API](https://airtable.com/api/meta)

### Community Resources
- [Airtable Community Forums](https://community.airtable.com/)
- [Third-party API Integrations](https://publicapi.dev/airtable-api)
- [PyAirtable ORM Documentation](https://pyairtable.readthedocs.io/)

### Research Notes
Research conducted via:
- Firecrawl MCP tool
- Exa web search MCP tool
- Direct API documentation review
- Community forum analysis

---

## Appendix A: Field Type Comparison Table

| Field Type | Currently Supported | Priority | Complexity |
|------------|---------------------|----------|------------|
| singleLineText | ✅ Yes | - | Low |
| multilineText | ✅ Yes | - | Low |
| richText | ❌ No | High | Low |
| email | ✅ Yes | - | Low |
| url | ❌ No | High | Low |
| phoneNumber | ✅ Yes | - | Low |
| number | ✅ Yes | - | Low |
| currency | ✅ Yes | - | Low |
| percent | ❌ No | High | Low |
| duration | ❌ No | Medium | Low |
| rating | ❌ No | High | Medium |
| autonumber | ❌ No | Medium | Low |
| singleSelect | ⚠️ Partial | High | Medium |
| multipleSelects | ⚠️ Partial | High | Medium |
| checkbox | ✅ Yes | - | Low |
| date | ⚠️ Partial | High | Medium |
| dateTime | ❌ No | High | Medium |
| createdTime | ❌ No | High | Low |
| lastModifiedTime | ❌ No | High | Low |
| createdBy | ❌ No | High | Low |
| lastModifiedBy | ❌ No | High | Low |
| singleCollaborator | ❌ No | Medium | Low |
| multipleCollaborators | ❌ No | Medium | Low |
| multipleRecordLinks | ❌ No | High | High |
| multipleLookupValues | ❌ No | Medium | High |
| rollup | ❌ No | Medium | High |
| count | ❌ No | Medium | Medium |
| formula | ❌ No | Medium | High |
| multipleAttachments | ❌ No | High | High |
| button | ❌ No | High | Medium |
| barcode | ❌ No | High | Medium |
| externalSyncSource | ❌ No | Low | High |
| aiText | ❌ No | Low | High |

**Legend:**
- ✅ Fully supported
- ⚠️ Partially supported (needs enhancement)
- ❌ Not supported

---

## Appendix B: Example Implementations

### Example 1: Creating a Table with New Field Types
```typescript
// Create a table with various field types
const response = await create_table({
  base_id: "appXXXXX",
  table_name: "Products",
  fields: [
    { name: "Name", type: "singleLineText" },
    { name: "Description", type: "richText" },
    { name: "Price", type: "currency", options: { precision: 2, symbol: "$" } },
    { name: "Discount", type: "percent", options: { precision: 1 } },
    { name: "Rating", type: "rating", options: { max: 5, icon: "star", color: "yellowBright" } },
    { name: "Website", type: "url" },
    { name: "Images", type: "multipleAttachments" },
    { name: "Status", type: "singleSelect", options: { 
      choices: [
        { name: "Active", color: "greenBright" },
        { name: "Inactive", color: "redBright" }
      ]
    }},
    { name: "Created", type: "createdTime" },
    { name: "Modified", type: "lastModifiedTime" }
  ]
});
```

### Example 2: Querying with Enhanced Parameters
```typescript
// List records with sorting, filtering, and pagination
const response = await list_records({
  base_id: "appXXXXX",
  table_name: "Products",
  max_records: 50,
  sort: [
    { field: "Rating", direction: "desc" },
    { field: "Price", direction: "asc" }
  ],
  filterByFormula: "AND({Status} = 'Active', {Price} < 100)",
  fields: ["Name", "Price", "Rating", "Website"],
  cellFormat: "json"
});
```

### Example 3: Creating Records with Complex Fields
```typescript
// Create a record with attachments and links
const response = await create_record({
  base_id: "appXXXXX",
  table_name: "Products",
  fields: {
    "Name": "Awesome Product",
    "Description": "# Great Product\n\nThis is **bold** text",
    "Price": 99.99,
    "Discount": 0.15, // 15%
    "Rating": 5,
    "Website": "https://example.com/product",
    "Status": { name: "Active" },
    "Images": [
      {
        url: "https://example.com/image1.jpg",
        filename: "product1.jpg"
      }
    ]
  }
});
```

---

## Conclusion

This specification provides a comprehensive roadmap for updating the Airtable MCP Server to support the current Airtable API. The phased approach allows for incremental improvements while maintaining backwards compatibility. Priority should be given to Phase 1 (critical field types) and Phase 4 (API enhancements) to provide the most value to users in the shortest timeframe.
