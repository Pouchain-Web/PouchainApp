import sys

def check_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    pairs = {'{': '}', '(': ')', '[': ']'}
    rev_pairs = {v: k for k, v in pairs.items()}
    
    in_string = False
    quote_char = None
    in_regex = False
    
    content_len = len(content)
    i = 0
    line_num = 1
    col_num = 0
    
    while i < content_len:
        char = content[i]
        col_num += 1
        
        if char == '\n':
            line_num += 1
            col_num = 0
            in_regex = False # Regex usually don't span lines unless escaped
        
        # Handle strings
        if not in_regex:
            if char in ["'", '"', '`'] and (i == 0 or content[i-1] != '\\'):
                if not in_string:
                    in_string = True
                    quote_char = char
                elif quote_char == char:
                    in_string = False
        
        # Handle comments (skipping the line if //)
        if not in_string and not in_regex:
            if char == '/' and i + 1 < content_len and content[i+1] == '/':
                while i < content_len and content[i] != '\n':
                    i += 1
                line_num += 1
                col_num = 0
                continue
            if char == '/' and i + 1 < content_len and content[i+1] == '*':
                i += 2
                while i + 1 < content_len and not (content[i] == '*' and content[i+1] == '/'):
                    if content[i] == '\n':
                        line_num += 1
                        col_num = 0
                    i += 1
                    col_num += 1
                i += 2
                continue

        # Handle Regex (very rough)
        if not in_string and not in_regex:
            if char == '/' and (i == 0 or content[i-1] in ['=', '(', ',', ':']):
                in_regex = True
        elif in_regex:
            if char == '/' and content[i-1] != '\\':
                in_regex = False
        
        if not in_string and not in_regex:
            if char in pairs:
                stack.append((char, line_num, col_num))
            elif char in rev_pairs:
                if not stack:
                    print(f"Extra '{char}' found at line {line_num}, col {col_num}")
                elif stack[-1][0] != rev_pairs[char]:
                    print(f"Mismatch: '{char}' at line {line_num} doesn't match '{stack[-1][0]}' from line {stack[-1][1]}")
                    stack.pop()
                else:
                    stack.pop()
        
        i += 1
    
    if not stack:
        print("All brackets are balanced")
    else:
        for item in stack:
            print(f"Unclosed '{item[0]}' started at line {item[1]}, col {item[2]}")

if __name__ == "__main__":
    check_balance(sys.argv[1])
