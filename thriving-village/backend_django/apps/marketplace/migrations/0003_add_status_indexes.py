from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0002_contestentry_enrollment_jobapplication_and_more"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="job",
            index=models.Index(fields=["status"], name="marketplace_job_status_idx"),
        ),
        migrations.AddIndex(
            model_name="contest",
            index=models.Index(fields=["status"], name="marketplace_contest_status_idx"),
        ),
    ]
