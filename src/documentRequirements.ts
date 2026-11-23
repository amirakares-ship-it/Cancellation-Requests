// Which "نوع المستند" (document type) options REQUIRE an uploaded file.
//
// The admin decides this per type (Dropdown Lists page -> "نوع المستند"). The
// choice is stored on the server as { [type]: true | false }. A type the admin
// has not decided yet is treated as REQUIRED, except types whose name says
// "Online" (nothing to upload), so "Online" works out of the box.
export type DocumentRequirements = Record<string, boolean>;

const ONLINE_LIKE = /online|[اأإ]ون\s*لاين/i;

export function isDocumentFileRequired(
  type: string,
  requirements: DocumentRequirements | null | undefined
): boolean {
  if (requirements && Object.prototype.hasOwnProperty.call(requirements, type)) {
    return !!requirements[type];
  }
  return !ONLINE_LIKE.test(type || '');
}
