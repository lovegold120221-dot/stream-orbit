import os
import ast
import re
from typing import List, Optional

# Configuration
EXCLUDE_DIRS = {
    'node_modules', '.git', '.next', 'venv', '.venv', '__pycache__', 
    'dist', 'build', 'out', '.gradle', 'target', 'dist-electron'
}
SUPPORTED_EXTENSIONS = {'.py', '.ts', '.tsx', '.js', '.jsx'}
MAX_TOTAL_LINES = 1000  # Token-efficient limit

def get_python_skeleton(file_path: str) -> str:
    """Extracts classes and functions from a Python file using AST."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read())
        
        skeleton = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                skeleton.append(f"class {node.name}:")
                for item in node.body:
                    if isinstance(item, ast.FunctionDef):
                        args = ast.unparse(item.args) if hasattr(ast, 'unparse') else "..."
                        skeleton.append(f"    def {item.name}({args}): ...")
            elif isinstance(node, ast.FunctionDef):
                args = ast.unparse(node.args) if hasattr(ast, 'unparse') else "..."
                skeleton.append(f"def {node.name}({args}): ...")
        return "\n".join(skeleton)
    except Exception:
        return "  (parsing error)"

def get_js_ts_skeleton(file_path: str) -> str:
    """Extracts classes and functions from JS/TS files using regex."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Simple regex for class and function signatures
        patterns = [
            r'(?:export\s+)?class\s+(\w+)',
            r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\((.*?)\)',
            r'(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>',
            r'(?:public|private|protected|static)?\s*(?:async\s+)?(\w+)\s*\((.*?)\)\s*\{'
        ]
        
        skeleton = []
        for line in content.splitlines():
            line = line.strip()
            for pattern in patterns:
                match = re.match(pattern, line)
                if match:
                    # Clean up matches to look like signatures
                    if 'class' in pattern:
                        skeleton.append(f"class {match.group(1)} {{ ... }}")
                    else:
                        skeleton.append(f"function {match.group(1)}({match.group(2)}) {{ ... }}")
                    break
        return "\n".join(skeleton)
    except Exception:
        return "  (parsing error)"

def generate_map(root_dir: str) -> str:
    """Generates the full repository map."""
    repo_map = []
    
    for root, dirs, files in os.walk(root_dir):
        # Prune excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        rel_path = os.path.relpath(root, root_dir)
        if rel_path == '.':
            rel_path = ''
        
        for file in files:
            ext = os.path.splitext(file)[1]
            if ext in SUPPORTED_EXTENSIONS:
                full_path = os.path.join(root, file)
                display_path = os.path.join(rel_path, file)
                
                repo_map.append(f"\n--- {display_path} ---")
                
                if ext == '.py':
                    skeleton = get_python_skeleton(full_path)
                else:
                    skeleton = get_js_ts_skeleton(full_path)
                
                if skeleton:
                    repo_map.append(skeleton)
                else:
                    repo_map.append("  (empty or no exported symbols)")

    # Combine and truncate if necessary
    full_map = "\n".join(repo_map)
    lines = full_map.splitlines()
    if len(lines) > MAX_TOTAL_LINES:
        return "\n".join(lines[:MAX_TOTAL_LINES]) + "\n... (truncated for efficiency)"
    return full_map

if __name__ == "__main__":
    import sys
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    print(generate_map(root))
