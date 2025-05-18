

def dict_to_str(d):
    """
    Convert a dictionary to a string representation.
    """
    return str(d).replace("'", '"')


def excel_to_str(excel_file):
    """
    Convert an Excel file to a string representation.
    """
    import pandas as pd
    df = pd.read_excel(excel_file)
    return df.to_string(index=False)