"""
Upload cypress diffs for inspection.

Useful when Travis fails but local doesn't
"""
import os
import shutil
import time

import tinys3


if __name__ == '__main__':
    filename = 'wilt-failures_{}'.format(time.time())
    failureDir = 'cypress/snapshots/index_spec.js/__diff_output__/'
    if os.path.isdir(failureDir) and len(os.listdir(failureDir)) > 0:
        shutil.make_archive(filename, 'zip', failureDir)
        filename += '.zip'

        conn = tinys3.Connection(
            os.environ['AWS_ACCESS_KEY_ID'],
            os.environ['AWS_SECRET_ACCESS_KEY'],
            tls=True
        )
        with open(filename, 'rb') as f:
            conn.upload(
                filename,
                f,
                os.environ['UPLOAD_IOS_SNAPSHOT_BUCKET_NAME']
            )
        print("Finished uploading.")
    else:
        print("No failures found")
