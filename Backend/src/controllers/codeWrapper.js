// ─── Code Wrapper
// Automatically wraps user code so they don't need to worry about
// boilerplate (class names, main methods, includes etc.)

export const wrapCode = (sourceCode, languageId) => {
  switch (languageId) {
    // ── Java ────────────────────────────────────────────────────────────────
    // If user already has a class definition → extract body and rewrap as Main
    // If user just wrote logic → wrap everything in Main + main()
    case 62: {
      const hasClassDefinition = /class\s+\w+/.test(sourceCode);
      const hasMainMethod =
        /public\s+static\s+void\s+main\s*\(/.test(sourceCode);

      // Case 1: User wrote a full class but named it something other than Main
      // → rename it to Main
      if (hasClassDefinition && hasMainMethod) {
        return sourceCode.replace(/class\s+\w+/, "class Main");
      }

      // Case 2: User wrote a full class already named Main → no change
      if (hasClassDefinition && /class\s+Main/.test(sourceCode)) {
        return sourceCode;
      }

      // Case 3: User only wrote the main() method body (most common in interviews)
      // → wrap in class Main
      if (!hasClassDefinition && hasMainMethod) {
        return `
public class Main {
  ${sourceCode}
}`.trim();
      }

      // Case 4: User just wrote raw statements (e.g. System.out.println("hi"))
      // → wrap in class Main + main method
      return `
public class Main {
  public static void main(String[] args) {
    ${sourceCode}
  }
}`.trim();
    }

    // ── C++ ─────────────────────────────────────────────────────────────────
    // If user already has #include and main() → no change
    // If user just wrote main body → wrap with common includes + main()
    case 54: {
      const hasIncludes = /#include/.test(sourceCode);
      const hasMain = /int\s+main\s*\(/.test(sourceCode);

      // Already a complete program
      if (hasIncludes && hasMain) {
        return sourceCode;
      }

      // Has main but no includes → add common includes
      if (!hasIncludes && hasMain) {
        return `
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <cmath>
using namespace std;

${sourceCode}`.trim();
      }

      // Just raw statements → wrap everything
      return `
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <cmath>
using namespace std;

int main() {
  ${sourceCode}
  return 0;
}`.trim();
    }

    // ── JavaScript ──────────────────────────────────────────────────────────
    // No wrapping needed — Node runs any JS directly
    case 63:
      return sourceCode;

    // ── Python ──────────────────────────────────────────────────────────────
    // No wrapping needed — Python runs any script directly
    case 71:
      return sourceCode;

    default:
      return sourceCode;
  }
};